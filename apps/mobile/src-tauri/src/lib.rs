#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    clavis_shell::attach(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error while running Clavis mobile");
}
