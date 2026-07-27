// lib.rs is the entry point used by Tauri's build system.
// All application setup happens here: plugins are registered and the
// event loop is started.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Enables the native file-open and file-save dialogs.
        .plugin(tauri_plugin_dialog::init())
        // Enables reading and writing files on the user's file system.
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
