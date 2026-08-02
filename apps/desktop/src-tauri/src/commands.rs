use std::fs;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use vault_core::{
    Entry, EntryType, create_vault as core_create, export_encrypted, import_csv_logins,
    import_encrypted, merge_entries, open_vault_file, vault_exists,
};

use crate::paths::{config_path, ensure_data_dir, vault_path};
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
    }
}

#[tauri::command]
pub fn get_data_dir(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let _ = state;
    let dir = ensure_data_dir(&app)?;
    Ok(dir.display().to_string())
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
    password: String,
) -> Result<StatusDto, String> {
    let path = vault_path(&app)?;
    ensure_data_dir(&app)?;
    let session = core_create(&path, &name, &password).map_err(map_err)?;
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
    password: String,
) -> Result<StatusDto, String> {
    let path = vault_path(&app)?;
    let session = open_vault_file(&path, &password).map_err(map_err)?;
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
    Ok(session.list_entries().iter().map(summary).collect())
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
    password: String,
) -> Result<StatusDto, String> {
    let bytes = fs::read(&source).map_err(map_err)?;
    let path = vault_path(&app)?;
    ensure_data_dir(&app)?;
    // Drop current session first.
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    let session = import_encrypted(&path, &bytes, &password).map_err(map_err)?;
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
pub fn import_csv(state: State<'_, AppState>, csv_text: String) -> Result<usize, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    let entries = import_csv_logins(&csv_text).map_err(map_err)?;
    let count = entries.len();
    let mut doc = session.document().clone();
    merge_entries(&mut doc, entries);
    session.replace_document(doc).map_err(map_err)?;
    Ok(count)
}

#[tauri::command]
pub fn change_master_password(
    state: State<'_, AppState>,
    current: String,
    new_password: String,
) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_mut()
        .ok_or_else(|| "vault is locked".to_string())?;
    session
        .change_password(&current, &new_password)
        .map_err(map_err)
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
pub fn store_keyring_secret(password: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(map_err)?;
    entry.set_password(&password).map_err(map_err)
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
    unlock(app, state, password)
}
