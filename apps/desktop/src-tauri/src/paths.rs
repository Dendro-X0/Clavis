use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

/// Portable data root: `{exe_parent}/data` (install directory), never OS user profile dumps.
pub fn app_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
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

pub fn data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_root(app)?.join("data"))
}

pub fn vault_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("vault.km"))
}

pub fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("config.json"))
}

pub fn ensure_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = data_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(dir.join("tmp")).map_err(|e| e.to_string())?;
    Ok(dir)
}
