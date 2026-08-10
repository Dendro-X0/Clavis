use std::fs;
use std::io::Read;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use zeroize::Zeroize;
use vault_core::{
    Entry, EntryType, GenerateOptions, HealthReport, HealthReportOptions, MatchCandidate,
    QuickAddDraft, TotpCode, VaultCryptoInfo, create_vault as core_create, export_encrypted,
    generate_password as core_generate_password, generate_totp_now, hibp_range_contains_suffix,
    hibp_range_parts, import_credentials_auto, import_credentials_from_path, import_csv_logins,
    import_encrypted, normalize_otp_secret, open_vault_file, parse_clipboard_for_quick_add,
    password_sha1_hex, peek_kdf_from_path, rank_entries_for_title, vault_exists,
};

use crate::autotype::{self, ForegroundWindowInfo};
use crate::paths::{
    app_root, config_path, ensure_data_dir, icons_dir, is_portable_data_dir, portable_data_dir,
    set_data_dir_override, vault_path,
};
use crate::state::{AppSettings, AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusDto {
    pub state: String,
    pub entry_count: Option<usize>,
    pub name: Option<String>,
    pub data_dir: String,
    /// True when encrypted vault bytes differ from `lastVaultSha256` stored previously.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub vault_fingerprint_changed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntrySummary {
    pub id: String,
    pub entry_type: EntryType,
    pub title: String,
    pub username: String,
    pub url: String,
    pub tags: Vec<String>,
    /// Included so dashboard search can match emails/phones without opening each entry.
    pub custom_fields: Vec<vault_core::CustomField>,
    /// True when entry has a TOTP seed (secret never listed).
    pub has_otp: bool,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertEntryInput {
    pub id: Option<String>,
    pub entry_type: EntryType,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub tags: Vec<String>,
    pub custom_fields: Vec<vault_core::CustomField>,
    #[serde(default)]
    pub otp_secret: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpCodeDto {
    pub code: String,
    pub seconds_remaining: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub id: String,
    pub name: String,
    pub entry_count: usize,
    pub source_file: Option<String>,
    pub active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub count: usize,
    pub workspace_id: String,
    pub workspace_name: String,
    pub replaced: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeDuplicatesResult {
    pub removed: usize,
    pub workspaces: Vec<WorkspaceSummary>,
}

fn workspace_name_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Imported".into())
}

fn map_workspace(session: &vault_core::VaultSession) -> Vec<WorkspaceSummary> {
    let active = session.active_workspace_id().to_string();
    session
        .list_workspaces()
        .iter()
        .map(|w| WorkspaceSummary {
            id: w.id.clone(),
            name: w.name.clone(),
            entry_count: w.entries.iter().filter(|e| !e.is_deleted()).count(),
            source_file: w.source_file.clone(),
            active: w.id == active,
        })
        .collect()
}

fn map_err(e: impl ToString) -> String {
    e.to_string()
}

fn summary(e: &Entry) -> EntrySummary {
    EntrySummary {
        id: e.id.clone(),
        entry_type: e.entry_type,
        title: e.title.clone(),
        username: e.username.clone(),
        url: e.url.clone(),
        tags: e.tags.clone(),
        custom_fields: e.custom_fields.clone(),
        has_otp: e.has_otp(),
        updated_at: e.updated_at.to_rfc3339(),
        deleted_at: e.deleted_at.map(|t| t.to_rfc3339()),
        workspace_id: None,
        workspace_name: None,
    }
}

fn summary_in_workspace(e: &Entry, workspace_id: &str, workspace_name: &str) -> EntrySummary {
    EntrySummary {
        id: e.id.clone(),
        entry_type: e.entry_type,
        title: e.title.clone(),
        username: e.username.clone(),
        url: e.url.clone(),
        tags: e.tags.clone(),
        custom_fields: e.custom_fields.clone(),
        has_otp: e.has_otp(),
        updated_at: e.updated_at.to_rfc3339(),
        deleted_at: e.deleted_at.map(|t| t.to_rfc3339()),
        workspace_id: Some(workspace_id.to_string()),
        workspace_name: Some(workspace_name.to_string()),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirInfo {
    pub path: String,
    pub portable: bool,
    pub app_root: String,
}

fn data_dir_info(app: &AppHandle) -> Result<DataDirInfo, String> {
    let dir = ensure_data_dir(app)?;
    Ok(DataDirInfo {
        path: dir.display().to_string(),
        portable: is_portable_data_dir(app)?,
        app_root: app_root(app)?.display().to_string(),
    })
}

fn sha256_hex_file(path: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let bytes = fs::read(path).map_err(map_err)?;
    let hash = Sha256::digest(&bytes);
    Ok(format!("{hash:x}"))
}

fn load_settings_disk(app: &AppHandle) -> Result<AppSettings, String> {
    let path = config_path(app)?;
    if path.is_file() {
        let text = fs::read_to_string(&path).map_err(map_err)?;
        return serde_json::from_str(&text).map_err(map_err);
    }
    Ok(AppSettings::default())
}

fn persist_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    ensure_data_dir(app)?;
    let path = config_path(app)?;
    let text = serde_json::to_string_pretty(settings).map_err(map_err)?;
    fs::write(&path, text).map_err(map_err)?;
    Ok(())
}

/// Compare vault file hash to stored fingerprint; update stored hash after unlock.
fn check_and_update_vault_fingerprint(
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<bool, String> {
    let path = vault_path(app)?;
    if !path.is_file() {
        return Ok(false);
    }
    let current = sha256_hex_file(&path)?;
    let mut settings = load_settings_disk(app)?;
    let changed = match settings.last_vault_sha256.as_deref() {
        Some(prev) if prev != current => true,
        _ => false,
    };
    settings.last_vault_sha256 = Some(current);
    persist_settings(app, &settings)?;
    *state.settings.lock().map_err(|e| e.to_string())? = settings;
    Ok(changed)
}

/// Update stored vault fingerprint after a successful persist (no change warning).
fn record_vault_fingerprint(app: &AppHandle, state: &State<'_, AppState>) -> Result<(), String> {
    let path = vault_path(app)?;
    if !path.is_file() {
        return Ok(());
    }
    let current = sha256_hex_file(&path)?;
    let mut settings = load_settings_disk(app)?;
    settings.last_vault_sha256 = Some(current);
    persist_settings(app, &settings)?;
    *state.settings.lock().map_err(|e| e.to_string())? = settings;
    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(map_err)?;
    for entry in fs::read_dir(src).map_err(map_err)? {
        let entry = entry.map_err(map_err)?;
        let ty = entry.file_type().map_err(map_err)?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to).map_err(map_err)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_data_dir(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let _ = state;
    let dir = ensure_data_dir(&app)?;
    Ok(dir.display().to_string())
}

#[tauri::command]
pub fn get_data_dir_info(app: AppHandle) -> Result<DataDirInfo, String> {
    data_dir_info(&app)
}

/// `path = None` restores portable `{exe}/data`. Locks the session if open.
#[tauri::command]
pub fn set_data_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<DataDirInfo, String> {
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    let custom = path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(std::path::Path::new);
    set_data_dir_override(&app, custom)?;
    data_dir_info(&app)
}

/// Copy current vault/config/icons into `{exe}/data/` and clear `data-location.json`.
#[tauri::command]
pub fn make_data_dir_portable(
    app: AppHandle,
    state: State<'_, AppState>,
    overwrite: bool,
) -> Result<DataDirInfo, String> {
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    if is_portable_data_dir(&app)? {
        return data_dir_info(&app);
    }

    let src_dir = ensure_data_dir(&app)?;
    let dest_dir = portable_data_dir(&app)?;
    let src_vault = src_dir.join("vault.km");
    let dest_vault = dest_dir.join("vault.km");

    if dest_vault.is_file() && src_vault.is_file() {
        let same = fs::read(&src_vault).ok() == fs::read(&dest_vault).ok();
        if !same && !overwrite {
            return Err(
                "portable data/vault.km already exists; pass overwrite to replace".into(),
            );
        }
    }

    fs::create_dir_all(&dest_dir).map_err(map_err)?;
    if src_vault.is_file() {
        fs::copy(&src_vault, &dest_vault).map_err(map_err)?;
    }
    let src_cfg = src_dir.join("config.json");
    if src_cfg.is_file() {
        fs::copy(&src_cfg, dest_dir.join("config.json")).map_err(map_err)?;
    }
    let src_icons = src_dir.join("icons");
    if src_icons.is_dir() {
        copy_dir_recursive(&src_icons, &dest_dir.join("icons"))?;
    }

    set_data_dir_override(&app, None)?;
    data_dir_info(&app)
}

#[tauri::command]
pub fn pick_data_dir(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = app;
        return Err("custom data folder is desktop-only; mobile uses the OS app sandbox".into());
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_dialog::DialogExt;
        let picked = app.dialog().file().blocking_pick_folder();
        Ok(picked
            .and_then(|p| p.into_path().ok())
            .map(|p| p.display().to_string()))
    }
}

#[tauri::command]
pub fn vault_status(app: AppHandle, state: State<'_, AppState>) -> Result<StatusDto, String> {
    let data = ensure_data_dir(&app)?;
    let path = vault_path(&app)?;
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.as_ref() {
        return Ok(StatusDto {
            state: "unlocked".into(),
            entry_count: Some(session.entry_count()),
            name: Some(session.document().meta.name.clone()),
            data_dir: data.display().to_string(),
            vault_fingerprint_changed: false,
        });
    }
    let state_str = if vault_exists(&path) {
        "locked"
    } else {
        "missing"
    };
    Ok(StatusDto {
        state: state_str.into(),
        entry_count: None,
        name: None,
        data_dir: data.display().to_string(),
        vault_fingerprint_changed: false,
    })
}

#[tauri::command]
pub fn create_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    mut password: String,
) -> Result<StatusDto, String> {
    let path = vault_path(&app)?;
    ensure_data_dir(&app)?;
    let session = core_create(&path, &name, &password).map_err(map_err);
    password.zeroize();
    let session = session?;
    let _ = check_and_update_vault_fingerprint(&app, &state)?;
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
        vault_fingerprint_changed: false,
    };
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(dto)
}

#[tauri::command]
pub fn unlock(
    app: AppHandle,
    state: State<'_, AppState>,
    mut password: String,
) -> Result<StatusDto, String> {
    let path = vault_path(&app)?;
    let session = open_vault_file(&path, &password).map_err(map_err);
    password.zeroize();
    let mut session = session?;
    let retain = load_settings_disk(&app)
        .map(|s| s.trash_retain_days)
        .unwrap_or(30);
    let _ = session.purge_expired_trash(retain);
    let changed = check_and_update_vault_fingerprint(&app, &state)?;
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
        vault_fingerprint_changed: changed,
    };
    state.clear_generator_history();
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(dto)
}

#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.take() {
        session.into_locked();
    }
    state.clear_generator_history();
    Ok(())
}

#[tauri::command]
pub fn list_entries(state: State<'_, AppState>) -> Result<Vec<EntrySummary>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session
        .list_entries()
        .map_err(map_err)?
        .into_iter()
        .map(summary)
        .collect())
}

#[tauri::command]
pub fn list_all_entries(state: State<'_, AppState>) -> Result<Vec<EntrySummary>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session
        .list_all_entries()
        .into_iter()
        .map(|(ws_id, ws_name, entry)| summary_in_workspace(entry, ws_id, ws_name))
        .collect())
}

#[tauri::command]
pub fn list_deleted_entries(state: State<'_, AppState>) -> Result<Vec<EntrySummary>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session
        .list_deleted_entries()
        .into_iter()
        .map(|(ws_id, ws_name, entry)| summary_in_workspace(entry, ws_id, ws_name))
        .collect())
}

#[tauri::command]
pub fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<WorkspaceSummary>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(map_workspace(session))
}

#[tauri::command]
pub fn set_active_workspace(state: State<'_, AppState>, id: String) -> Result<Vec<WorkspaceSummary>, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    session.set_active_workspace(&id).map_err(map_err)?;
    Ok(map_workspace(session))
}

#[tauri::command]
pub fn create_workspace(state: State<'_, AppState>, name: String) -> Result<WorkspaceSummary, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    let ws = session.create_workspace(&name).map_err(map_err)?;
    Ok(WorkspaceSummary {
        id: ws.id,
        name: ws.name,
        entry_count: 0,
        source_file: ws.source_file,
        active: true,
    })
}

#[tauri::command]
pub fn rename_workspace(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<Vec<WorkspaceSummary>, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    session.rename_workspace(&id, &name).map_err(map_err)?;
    Ok(map_workspace(session))
}

#[tauri::command]
pub fn delete_workspace(state: State<'_, AppState>, id: String) -> Result<Vec<WorkspaceSummary>, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    session.delete_workspace(&id).map_err(map_err)?;
    Ok(map_workspace(session))
}

#[tauri::command]
pub fn merge_duplicate_workspaces(state: State<'_, AppState>) -> Result<MergeDuplicatesResult, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    let removed = session.merge_duplicate_workspaces().map_err(map_err)?;
    Ok(MergeDuplicatesResult {
        removed,
        workspaces: map_workspace(session),
    })
}

#[tauri::command]
pub fn get_entry(state: State<'_, AppState>, id: String) -> Result<Entry, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    session.get_entry(&id).map(|e| e.clone()).map_err(map_err)
}

#[tauri::command]
pub fn entry_totp_code(state: State<'_, AppState>, id: String) -> Result<TotpCodeDto, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    let entry = session.get_entry(&id).map_err(map_err)?;
    if !entry.has_otp() {
        return Err("entry has no TOTP secret".into());
    }
    let TotpCode {
        code,
        seconds_remaining,
    } = generate_totp_now(&entry.otp_secret).map_err(map_err)?;
    Ok(TotpCodeDto {
        code,
        seconds_remaining,
    })
}

#[tauri::command]
pub fn upsert_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    input: UpsertEntryInput,
) -> Result<Entry, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;

    let entry = if let Some(id) = input.id {
        let mut existing = session.get_entry(&id).map_err(map_err)?.clone();
        existing.entry_type = input.entry_type;
        existing.title = input.title;
        existing.username = input.username;
        existing.password = input.password;
        existing.url = input.url;
        existing.notes = input.notes;
        existing.tags = input.tags;
        existing.custom_fields = input.custom_fields;
        existing.otp_secret = normalize_otp_secret(&input.otp_secret).map_err(map_err)?;
        existing
    } else {
        let mut e = Entry::new(input.entry_type, input.title);
        e.username = input.username;
        e.password = input.password;
        e.url = input.url;
        e.notes = input.notes;
        e.tags = input.tags;
        e.custom_fields = input.custom_fields;
        e.otp_secret = normalize_otp_secret(&input.otp_secret).map_err(map_err)?;
        e
    };

    let saved = session.upsert_entry(entry).map_err(map_err)?;
    drop(guard);
    let _ = record_vault_fingerprint(&app, &state);
    Ok(saved)
}

#[tauri::command]
pub fn delete_entry(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session.delete_entry(&id).map_err(map_err)?;
    }
    let _ = record_vault_fingerprint(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn restore_entry(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Entry, String> {
    let saved = {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session.restore_entry(&id).map_err(map_err)?
    };
    let _ = record_vault_fingerprint(&app, &state);
    Ok(saved)
}

#[tauri::command]
pub fn purge_entry(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session.purge_entry(&id).map_err(map_err)?;
    }
    let _ = record_vault_fingerprint(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn empty_trash(app: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    let removed = {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session.empty_trash().map_err(map_err)?
    };
    let _ = record_vault_fingerprint(&app, &state);
    Ok(removed)
}

#[tauri::command]
pub fn trash_count(state: State<'_, AppState>) -> Result<usize, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session.trash_count())
}

#[tauri::command]
pub fn export_vault(app: AppHandle, state: State<'_, AppState>, dest: String) -> Result<(), String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    // Prefer writing under app data/tmp or explicit path chosen by dialog (user-selected).
    let dest_path = std::path::PathBuf::from(dest);
    export_encrypted(session, &dest_path).map_err(map_err)?;
    let _ = app;
    Ok(())
}

#[tauri::command]
pub fn import_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    source: String,
    mut password: String,
) -> Result<StatusDto, String> {
    let bytes = fs::read(&source).map_err(map_err)?;
    let path = vault_path(&app)?;
    ensure_data_dir(&app)?;
    // Drop current session first.
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    let session = import_encrypted(&path, &bytes, &password).map_err(map_err);
    password.zeroize();
    let session = session?;
    let _ = check_and_update_vault_fingerprint(&app, &state)?;
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
        vault_fingerprint_changed: false,
    };
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(dto)
}

#[tauri::command]
pub fn import_csv(
    state: State<'_, AppState>,
    csv_text: String,
    mode: Option<String>,
    workspace_name: Option<String>,
    workspace_id: Option<String>,
) -> Result<ImportResult, String> {
    import_entries_into_workspace(
        state,
        import_csv_logins(&csv_text).map_err(map_err)?,
        mode.as_deref().unwrap_or("new"),
        workspace_name.unwrap_or_else(|| "CSV import".into()),
        None,
        workspace_id,
    )
}

#[tauri::command]
pub fn import_credentials_file(
    state: State<'_, AppState>,
    path: String,
    mode: Option<String>,
    workspace_id: Option<String>,
) -> Result<ImportResult, String> {
    let entries = import_credentials_from_path(std::path::Path::new(&path)).map_err(map_err)?;
    let name = workspace_name_from_path(&path);
    let source = std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());
    import_entries_into_workspace(
        state,
        entries,
        mode.as_deref().unwrap_or("new"),
        name,
        source,
        workspace_id,
    )
}

#[tauri::command]
pub fn import_credentials_text(
    state: State<'_, AppState>,
    text: String,
    mode: Option<String>,
    workspace_name: Option<String>,
    workspace_id: Option<String>,
) -> Result<ImportResult, String> {
    let entries = import_credentials_auto(&text).map_err(map_err)?;
    import_entries_into_workspace(
        state,
        entries,
        mode.as_deref().unwrap_or("new"),
        workspace_name.unwrap_or_else(|| "Pasted import".into()),
        None,
        workspace_id,
    )
}

fn import_entries_into_workspace(
    state: State<'_, AppState>,
    entries: Vec<Entry>,
    mode: &str,
    name: String,
    source_file: Option<String>,
    workspace_id: Option<String>,
) -> Result<ImportResult, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    let count = entries.len();
    let replace = mode.eq_ignore_ascii_case("replace");
    let ws = if replace {
        let id = workspace_id
            .filter(|s| !s.trim().is_empty())
            .or_else(|| session.find_workspace_id_by_name(&name))
            .unwrap_or_else(|| session.active_workspace_id().to_string());
        session
            .replace_workspace_entries(&id, entries, source_file)
            .map_err(map_err)?
    } else {
        session
            .import_as_workspace(&name, source_file, entries)
            .map_err(map_err)?
    };
    Ok(ImportResult {
        count,
        workspace_id: ws.id,
        workspace_name: ws.name,
        replaced: replace,
    })
}

/// Native file open dialog (avoids Next.js JS chunk failures for plugin-dialog).
#[tauri::command]
pub fn pick_open_path(app: AppHandle, kind: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let dialog = app.dialog().file();
    let picked = match kind.as_str() {
        "vault" => dialog
            .add_filter("Vault backup", &["km"])
            .blocking_pick_file(),
        "csv" => dialog
            .add_filter("CSV / TSV", &["csv", "tsv"])
            .blocking_pick_file(),
        "credentials" => dialog
            .add_filter(
                "Credentials",
                &["txt", "md", "csv", "tsv", "xlsx", "xls", "ods"],
            )
            .add_filter("Text", &["txt", "md"])
            .add_filter("Spreadsheet", &["csv", "tsv", "xlsx", "xls", "ods"])
            .blocking_pick_file(),
        _ => dialog.blocking_pick_file(),
    };

    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string()))
}

#[tauri::command]
pub fn pick_save_path(
    app: AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Vault backup", &["km"]);
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }
    let picked = dialog.blocking_save_file();
    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string()))
}

#[tauri::command]
pub fn change_master_password(
    app: AppHandle,
    state: State<'_, AppState>,
    mut current: String,
    mut new_password: String,
) -> Result<(), String> {
    let result = (|| {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session
            .change_password(&current, &new_password)
            .map_err(map_err)
    })();
    current.zeroize();
    new_password.zeroize();
    result?;
    let _ = record_vault_fingerprint(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn vault_crypto_info(state: State<'_, AppState>) -> Result<VaultCryptoInfo, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session.crypto_info())
}

#[tauri::command]
pub fn peek_vault_kdf(path: String) -> Result<VaultCryptoInfo, String> {
    peek_kdf_from_path(std::path::Path::new(&path)).map_err(map_err)
}

#[tauri::command]
pub fn default_vault_kdf() -> VaultCryptoInfo {
    VaultCryptoInfo::defaults()
}

#[tauri::command]
pub fn upgrade_vault_kdf(
    app: AppHandle,
    state: State<'_, AppState>,
    mut password: String,
) -> Result<VaultCryptoInfo, String> {
    let result = (|| {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "vault is locked".to_string())?;
        session.upgrade_kdf_to_defaults(&password).map_err(map_err)
    })();
    password.zeroize();
    let info = result?;
    let _ = record_vault_fingerprint(&app, &state);
    Ok(info)
}

#[tauri::command]
pub fn get_settings(app: AppHandle, state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = load_settings_disk(&app)?;
    *state.settings.lock().map_err(|e| e.to_string())? = settings.clone();
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    mut settings: AppSettings,
) -> Result<(), String> {
    // Preserve vault fingerprint if the UI omitted it.
    if settings.last_vault_sha256.is_none() {
        if let Ok(existing) = load_settings_disk(&app) {
            settings.last_vault_sha256 = existing.last_vault_sha256;
        }
    }
    persist_settings(&app, &settings)?;
    *state.settings.lock().map_err(|e| e.to_string())? = settings;
    Ok(())
}

#[tauri::command]
pub fn generate_password(
    state: State<'_, AppState>,
    options: Option<GenerateOptions>,
    length: Option<usize>,
) -> Result<String, String> {
    let opts = if let Some(o) = options {
        o
    } else {
        GenerateOptions::strong(length.unwrap_or(20))
    };
    let password = core_generate_password(&opts)?;
    state.push_generator_history(&password);
    Ok(password)
}

#[tauri::command]
pub fn generator_history(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let hist = state.generator_history.lock().map_err(|e| e.to_string())?;
    Ok(hist.clone())
}

#[tauri::command]
pub fn clear_generator_history(state: State<'_, AppState>) -> Result<(), String> {
    state.clear_generator_history();
    Ok(())
}

/// Parse clipboard text into an unsaved draft. Requires unlocked vault (session present).
#[tauri::command]
pub fn clipboard_quick_add(
    state: State<'_, AppState>,
    text: String,
) -> Result<Option<QuickAddDraft>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let _session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(parse_clipboard_for_quick_add(&text))
}

#[tauri::command]
pub fn password_health_report(
    state: State<'_, AppState>,
    options: Option<HealthReportOptions>,
) -> Result<HealthReport, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session.password_health_report(options.unwrap_or_default()))
}

/// One-shot HIBP k-anonymity check for a single password (never logged).
#[tauri::command]
pub fn check_password_breached(
    state: State<'_, AppState>,
    mut password: String,
) -> Result<bool, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    if !(settings.allow_network && settings.check_breaches) {
        password.zeroize();
        return Err("breach checks require Network and Check breaches in Settings".into());
    }
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let _session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    drop(guard);

    let hex = password_sha1_hex(&password);
    password.zeroize();
    let (prefix, suffix) = hibp_range_parts(&hex).ok_or_else(|| "invalid hash".to_string())?;
    let url = format!("https://api.pwnedpasswords.com/range/{prefix}");
    let body = ureq::get(&url)
        .set("User-Agent", "Clavis-local-vault")
        .set("Add-Padding", "true")
        .call()
        .map_err(|e| format!("HIBP request failed: {e}"))?
        .into_string()
        .map_err(|e| format!("HIBP read failed: {e}"))?;
    Ok(hibp_range_contains_suffix(&body, suffix))
}

/// Run HIBP against scored entry passwords; returns entry ids that matched (no passwords).
#[tauri::command]
pub fn check_vault_breaches(
    state: State<'_, AppState>,
    options: Option<HealthReportOptions>,
) -> Result<Vec<String>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    if !(settings.allow_network && settings.check_breaches) {
        return Err("breach checks require Network and Check breaches in Settings".into());
    }

    let opts = options.unwrap_or_default();
    let mut passwords: Vec<(String, String)> = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
        let mut out = Vec::new();
        let workspaces: Vec<_> = if opts.all_workspaces {
            session.list_workspaces().iter().collect()
        } else {
            session
                .document()
                .active_workspace()
                .into_iter()
                .collect()
        };
        for ws in workspaces {
            for entry in &ws.entries {
                if !opts.include_trash && entry.is_deleted() {
                    continue;
                }
                if entry.password.is_empty() {
                    continue;
                }
                out.push((entry.id.clone(), entry.password.clone()));
            }
        }
        out
    };

    let mut breached_ids = Vec::new();
    for (id, mut password) in passwords.drain(..) {
        let hex = password_sha1_hex(&password);
        password.zeroize();
        let Some((prefix, suffix)) = hibp_range_parts(&hex) else {
            continue;
        };
        let url = format!("https://api.pwnedpasswords.com/range/{prefix}");
        let body = match ureq::get(&url)
            .set("User-Agent", "Clavis-local-vault")
            .set("Add-Padding", "true")
            .call()
        {
            Ok(resp) => resp.into_string().unwrap_or_default(),
            Err(_) => continue,
        };
        if hibp_range_contains_suffix(&body, suffix) {
            breached_ids.push(id);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Ok(breached_ids)
}

#[tauri::command]
pub fn get_foreground_window_info(
    state: State<'_, AppState>,
) -> Result<ForegroundWindowInfo, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let _session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    drop(guard);
    autotype::foreground_window_info()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutotypeOptions {
    #[serde(default)]
    pub expected_title: Option<String>,
    #[serde(default)]
    pub key_delay_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutotypeMode {
    Username,
    Password,
    Login,
    Totp,
}

/// Confirm-gated autotype. UI must show foreground title and pass `expectedTitle`.
#[tauri::command]
pub fn autotype_entry(
    state: State<'_, AppState>,
    id: String,
    mode: AutotypeMode,
    options: Option<AutotypeOptions>,
) -> Result<(), String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    if !settings.autotype_enabled {
        return Err("autotype is disabled in Settings".into());
    }
    let opts = options.unwrap_or(AutotypeOptions {
        expected_title: None,
        key_delay_ms: None,
    });
    let delay = opts
        .key_delay_ms
        .unwrap_or(settings.autotype_key_delay_ms)
        .clamp(0, 200);

    let (username, mut password, otp_secret) = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
        let entry = session.get_entry(&id).map_err(map_err)?;
        (
            entry.username.clone(),
            entry.password.clone(),
            entry.otp_secret.clone(),
        )
    };

    if let Some(ref expected) = opts.expected_title {
        autotype::assert_foreground_title(expected)?;
    }

    let result = (|| -> Result<(), String> {
        match mode {
            AutotypeMode::Username => autotype::type_text(&username, delay),
            AutotypeMode::Password => autotype::type_text(&password, delay),
            AutotypeMode::Login => {
                autotype::type_text(&username, delay)?;
                autotype::type_tab(delay)?;
                if let Some(ref expected) = opts.expected_title {
                    autotype::assert_foreground_title(expected)?;
                }
                autotype::type_text(&password, delay)
            }
            AutotypeMode::Totp => {
                if otp_secret.trim().is_empty() {
                    return Err("entry has no TOTP secret".into());
                }
                let code = generate_totp_now(&otp_secret).map_err(map_err)?;
                autotype::type_text(&code.code, delay)
            }
        }
    })();
    password.zeroize();
    result
}

#[tauri::command]
pub fn suggest_entries_for_foreground(
    state: State<'_, AppState>,
) -> Result<Vec<MatchCandidate>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    if !settings.suggest_from_foreground {
        return Ok(Vec::new());
    }
    let info = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        let _session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
        drop(guard);
        autotype::foreground_window_info()?
    };
    if !info.supported || info.title.trim().is_empty() {
        return Ok(Vec::new());
    }
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    let rows = session.list_all_entries();
    Ok(rank_entries_for_title(&info.title, &rows, 5))
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(map_err)
}

const KEYRING_SERVICE: &str = "keys-manager";
const KEYRING_USER: &str = "master-unlock";

#[tauri::command]
pub fn store_keyring_secret(mut password: String) -> Result<(), String> {
    let result = (|| {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(map_err)?;
        entry.set_password(&password).map_err(map_err)
    })();
    password.zeroize();
    result
}

#[tauri::command]
pub fn clear_keyring_secret() -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(map_err)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn try_keyring_unlock(app: AppHandle, state: State<'_, AppState>) -> Result<StatusDto, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(map_err)?;
    let password = entry.get_password().map_err(map_err)?;
    // `unlock` zeroizes its owned password String before returning.
    unlock(app, state, password)
}

fn sanitize_icon_host(host: &str) -> String {
    let h = host.trim().to_lowercase();
    let h = h.strip_prefix("www.").unwrap_or(&h);
    h.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('.')
        .to_string()
}

fn icon_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF8") {
        "image/gif"
    } else if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") {
        "image/svg+xml"
    } else if bytes.len() >= 4 && bytes[0..4] == [0, 0, 1, 0] {
        "image/x-icon"
    } else {
        "image/png"
    }
}

fn bytes_to_data_url(bytes: &[u8]) -> String {
    format!(
        "data:{};base64,{}",
        icon_mime(bytes),
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
    )
}

fn icon_cache_path(app: &AppHandle, host: &str) -> Result<std::path::PathBuf, String> {
    let key = sanitize_icon_host(host);
    if key.is_empty() {
        return Err("empty host".into());
    }
    Ok(icons_dir(app)?.join(format!("{key}.bin")))
}

#[tauri::command]
pub fn read_entry_icon(app: AppHandle, host: String) -> Result<Option<String>, String> {
    let path = icon_cache_path(&app, &host)?;
    if !path.is_file() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(map_err)?;
    if bytes.is_empty() {
        return Ok(None);
    }
    Ok(Some(bytes_to_data_url(&bytes)))
}

#[tauri::command]
pub fn fetch_entry_icon(app: AppHandle, state: State<'_, AppState>, host: String) -> Result<Option<String>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    // Always allow reading a previously cached icon from disk.
    let key = sanitize_icon_host(&host);
    if key.is_empty() {
        return Ok(None);
    }
    let path = icon_cache_path(&app, &host)?;
    if path.is_file() {
        let bytes = fs::read(&path).map_err(map_err)?;
        if !bytes.is_empty() {
            return Ok(Some(bytes_to_data_url(&bytes)));
        }
    }

    if !(settings.allow_network && settings.fetch_favicons) {
        return Ok(None);
    }

    let urls = [
        format!("https://{key}/favicon.ico"),
        format!("https://www.google.com/s2/favicons?domain={key}&sz=64"),
    ];
    for url in urls {
        let resp = ureq::get(&url)
            .set("User-Agent", "Clavis/0.7")
            .timeout(std::time::Duration::from_secs(8))
            .call();
        let Ok(resp) = resp else { continue };
        if !(200..300).contains(&resp.status()) {
            continue;
        }
        let mut bytes = Vec::new();
        if resp.into_reader().take(256 * 1024).read_to_end(&mut bytes).is_err() {
            continue;
        }
        if bytes.len() < 16 {
            continue;
        }
        fs::write(&path, &bytes).map_err(map_err)?;
        return Ok(Some(bytes_to_data_url(&bytes)));
    }
    Ok(None)
}
