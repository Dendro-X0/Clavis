//! Shared Clavis Tauri shell — commands, paths, and builder wiring.
//! Desktop and mobile crates own `generate_context!()` next to their configs.

mod commands;
mod paths;
mod state;

pub use state::{AppSettings, AppState};

/// Attach plugins, state, and invoke handlers to a Tauri builder.
pub fn attach(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::get_data_dir,
            commands::get_data_dir_info,
            commands::set_data_dir,
            commands::make_data_dir_portable,
            commands::pick_data_dir,
            commands::create_vault,
            commands::unlock,
            commands::lock,
            commands::list_entries,
            commands::list_all_entries,
            commands::list_deleted_entries,
            commands::list_workspaces,
            commands::set_active_workspace,
            commands::create_workspace,
            commands::rename_workspace,
            commands::delete_workspace,
            commands::merge_duplicate_workspaces,
            commands::get_entry,
            commands::entry_totp_code,
            commands::upsert_entry,
            commands::delete_entry,
            commands::restore_entry,
            commands::purge_entry,
            commands::empty_trash,
            commands::trash_count,
            commands::export_vault,
            commands::import_vault,
            commands::import_csv,
            commands::import_credentials_file,
            commands::import_credentials_text,
            commands::pick_open_path,
            commands::pick_save_path,
            commands::change_master_password,
            commands::vault_crypto_info,
            commands::peek_vault_kdf,
            commands::default_vault_kdf,
            commands::upgrade_vault_kdf,
            commands::get_settings,
            commands::save_settings,
            commands::generate_password,
            commands::generator_history,
            commands::clear_generator_history,
            commands::clipboard_quick_add,
            commands::read_text_file,
            commands::try_keyring_unlock,
            commands::store_keyring_secret,
            commands::clear_keyring_secret,
            commands::read_entry_icon,
            commands::fetch_entry_icon,
        ])
        .setup(|app| {
            let data_dir = paths::ensure_data_dir(app.handle())?;
            println!("Clavis data dir: {}", data_dir.display());
            Ok(())
        })
}
