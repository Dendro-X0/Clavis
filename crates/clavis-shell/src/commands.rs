use std::fs;
use std::io::Read;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use zeroize::Zeroize;
use vault_core::{
    Entry, EntryType, VaultCryptoInfo, create_vault as core_create, export_encrypted,
    import_credentials_auto, import_credentials_from_path, import_csv_logins, import_encrypted,
    open_vault_file, peek_kdf_from_path, vault_exists,
};

use crate::paths::{
    config_path, ensure_data_dir, icons_dir, is_portable_data_dir, set_data_dir_override, vault_path,
};
use crate::state::{AppSettings, AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusDto {
    pub state: String,
    pub entry_count: Option<usize>,
    pub name: Option<String>,
    pub data_dir: String,
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
    pub updated_at: String,
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
            entry_count: w.entries.len(),
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
        updated_at: e.updated_at.to_rfc3339(),
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
        updated_at: e.updated_at.to_rfc3339(),
        workspace_id: Some(workspace_id.to_string()),
        workspace_name: Some(workspace_name.to_string()),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirInfo {
    pub path: String,
    pub portable: bool,
}

#[tauri::command]
pub fn get_data_dir(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let _ = state;
    let dir = ensure_data_dir(&app)?;
    Ok(dir.display().to_string())
}

#[tauri::command]
pub fn get_data_dir_info(app: AppHandle) -> Result<DataDirInfo, String> {
    let dir = ensure_data_dir(&app)?;
    Ok(DataDirInfo {
        path: dir.display().to_string(),
        portable: is_portable_data_dir(&app)?,
    })
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
    get_data_dir_info(app)
}

#[tauri::command]
pub fn pick_data_dir(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().blocking_pick_folder();
    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string()))
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
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
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
    let session = session?;
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
    };
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(dto)
}

#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.take() {
        session.into_locked();
    }
    Ok(())
}

#[tauri::command]
pub fn list_entries(state: State<'_, AppState>) -> Result<Vec<EntrySummary>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or_else(|| "vault is locked".to_string())?;
    Ok(session
        .list_entries()
        .map_err(map_err)?
        .iter()
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
pub fn upsert_entry(
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
        existing
    } else {
        let mut e = Entry::new(input.entry_type, input.title);
        e.username = input.username;
        e.password = input.password;
        e.url = input.url;
        e.notes = input.notes;
        e.tags = input.tags;
        e.custom_fields = input.custom_fields;
        e
    };

    session.upsert_entry(entry).map_err(map_err)
}

#[tauri::command]
pub fn delete_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    session.delete_entry(&id).map_err(map_err)
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
    let dto = StatusDto {
        state: "unlocked".into(),
        entry_count: Some(session.entry_count()),
        name: Some(session.document().meta.name.clone()),
        data_dir: ensure_data_dir(&app)?.display().to_string(),
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
    result
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
    result
}

#[tauri::command]
pub fn get_settings(app: AppHandle, state: State<'_, AppState>) -> Result<AppSettings, String> {
    let path = config_path(&app)?;
    if path.is_file() {
        let text = fs::read_to_string(&path).map_err(map_err)?;
        let settings: AppSettings = serde_json::from_str(&text).map_err(map_err)?;
        *state.settings.lock().map_err(|e| e.to_string())? = settings.clone();
        return Ok(settings);
    }
    Ok(state.settings.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    ensure_data_dir(&app)?;
    let path = config_path(&app)?;
    let text = serde_json::to_string_pretty(&settings).map_err(map_err)?;
    fs::write(&path, text).map_err(map_err)?;
    *state.settings.lock().map_err(|e| e.to_string())? = settings;
    Ok(())
}

#[tauri::command]
pub fn generate_password(length: usize) -> Result<String, String> {
    use rand::Rng;
    let len = length.clamp(8, 128);
    const CHARSET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
    let mut rng = rand::thread_rng();
    let password: String = (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();
    Ok(password)
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
pub fn fetch_entry_icon(app: AppHandle, host: String) -> Result<Option<String>, String> {
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

    let urls = [
        format!("https://{key}/favicon.ico"),
        format!("https://www.google.com/s2/favicons?domain={key}&sz=64"),
    ];
    for url in urls {
        let resp = ureq::get(&url)
            .set("User-Agent", "Clavis/0.3")
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
