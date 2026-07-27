// On Windows in release mode this attribute hides the console window that
// would otherwise appear behind the app. It has no effect on other platforms.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run()
}
