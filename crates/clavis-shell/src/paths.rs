use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

/// Optional override stored next to the executable (not inside the vault data dir).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataLocationFile {
    /// Absolute path to the data directory. Empty / missing → portable `{exe}/data`.
    #[serde(default)]
    data_dir: Option<String>,
}

/// App install / sandbox root used to resolve the data directory.
///
/// - **Desktop:** `{exe_parent}` (portable install folder).
/// - **Mobile:** OS app data directory (sandboxed); not next to a user-visible binary.
pub fn app_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        return app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string());
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                // In `tauri dev`, exe lives under target/...; still keep data next to that binary
                // so secrets never land in Documents/Desktop. For portable release bundles this
                // is the install directory.
                return Ok(parent.to_path_buf());
            }
        }
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())
    }
}

fn data_location_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("data-location.json"))
}

fn read_override<R: Runtime>(app: &AppHandle<R>) -> Result<Option<PathBuf>, String> {
    let path = data_location_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let parsed: DataLocationFile = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(parsed
        .data_dir
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from))
}

pub fn data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    if let Some(custom) = read_override(app)? {
        return Ok(custom);
    }
    portable_data_dir(app)
}

/// Always `{exe}/data` (ignores custom override).
pub fn portable_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("data"))
}

pub fn is_portable_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    Ok(read_override(app)?.is_none())
}

/// Set custom data directory, or `None` to restore portable `{exe}/data`.
/// Caller should lock the vault first; paths take effect on next ensure/open.
pub fn set_data_dir_override<R: Runtime>(
    app: &AppHandle<R>,
    custom: Option<&Path>,
) -> Result<PathBuf, String> {
    let pointer = data_location_path(app)?;
    match custom {
        None => {
            if pointer.is_file() {
                fs::remove_file(&pointer).map_err(|e| e.to_string())?;
            }
        }
        Some(dir) => {
            let abs = if dir.is_absolute() {
                dir.to_path_buf()
            } else {
                std::env::current_dir()
                    .map_err(|e| e.to_string())?
                    .join(dir)
            };
            fs::create_dir_all(&abs).map_err(|e| e.to_string())?;
            let payload = DataLocationFile {
                data_dir: Some(abs.display().to_string()),
            };
            let text = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
            fs::write(&pointer, text).map_err(|e| e.to_string())?;
        }
    }
    ensure_data_dir(app)
}

pub fn vault_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("vault.km"))
}

pub fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("config.json"))
}

pub fn ensure_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = data_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("tmp")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("icons")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("snapshots")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("attachments")).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn icons_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = ensure_data_dir(app)?.join("icons");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn snapshots_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = ensure_data_dir(app)?.join("snapshots");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn attachments_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = ensure_data_dir(app)?.join("attachments");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn entry_attachments_dir<R: Runtime>(app: &AppHandle<R>, entry_id: &str) -> Result<PathBuf, String> {
    let dir = attachments_dir(app)?.join(entry_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
