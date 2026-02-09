mod keychain;
mod logger;
mod external;
mod pty;

use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            // PTY commands
            pty::spawn_shell,
            pty::write_to_pty,
            pty::resize_pty,
            pty::kill_pty,
            pty::get_cwd,
            pty::get_system_info,
            pty::list_directory,
            // Keychain commands
            keychain::store_api_key,
            keychain::get_api_key,
            keychain::delete_api_key,
            // Logger commands
            logger::write_log,
            logger::get_log_entries,
            logger::get_log_dates,
            // External actions
            external::open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Terminal");
}
