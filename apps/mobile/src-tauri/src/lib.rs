#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(mobile)]
    {
        clavis_shell::attach(tauri::Builder::default())
            .plugin(tauri_plugin_biometric::init())
            .setup(|app| clavis_shell::prepare(app.handle()))
            .run(tauri::generate_context!())
            .expect("error while running Clavis mobile");
    }

    #[cfg(not(mobile))]
    {
        // Host `cargo check` / desktop-target builds of this crate: biometric plugin is mobile-only.
        clavis_shell::attach(tauri::Builder::default())
            .setup(|app| clavis_shell::prepare(app.handle()))
            .run(tauri::generate_context!())
            .expect("error while running Clavis mobile");
    }
}
