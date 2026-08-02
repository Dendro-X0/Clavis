#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod paths;
mod state;

use state::AppState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::get_data_dir,
            commands::create_vault,
            commands::unlock,
            commands::lock,
            commands::list_entries,
            commands::list_workspaces,
            commands::set_active_workspace,
            commands::create_workspace,
            commands::rename_workspace,
            commands::delete_workspace,
            commands::merge_duplicate_workspaces,
            commands::get_entry,
            commands::upsert_entry,
            commands::delete_entry,
            commands::export_vault,
            commands::import_vault,
            commands::import_csv,
            commands::import_credentials_file,
            commands::import_credentials_text,
            commands::pick_open_path,
            commands::pick_save_path,
            commands::change_master_password,
            commands::get_settings,
            commands::save_settings,
            commands::generate_password,
            commands::read_text_file,
            commands::try_keyring_unlock,
            commands::store_keyring_secret,
            commands::clear_keyring_secret,
        ])
        .setup(|app| {
            let data_dir = paths::ensure_data_dir(app.handle())?;
            println!("Keys Manager data dir: {}", data_dir.display());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Keys Manager");
}
