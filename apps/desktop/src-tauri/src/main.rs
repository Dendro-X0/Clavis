#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    clavis_shell::attach(tauri::Builder::default())
        .setup(|app| {
            // Ensure the taskbar / alt-tab icon matches the bundled mark even if the OS
            // cached an older .exe resource (common after icon swaps on Windows).
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))?;
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Clavis");
}
