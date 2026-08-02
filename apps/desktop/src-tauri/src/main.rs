#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    clavis_shell::attach(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error while running Clavis");
}
