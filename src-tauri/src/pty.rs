use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

/// Represents an active PTY session.
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child_id: u32,
    cwd: String,
}

/// Manages all PTY sessions.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, Arc<Mutex<PtySession>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

fn emit_pty_exit_once(app: &AppHandle, session_id: &str, exit_emitted: &AtomicBool) {
    if !exit_emitted.swap(true, Ordering::AcqRel) {
        let _ = app.emit("pty-exit", session_id);
    }
}

#[cfg(unix)]
fn terminate_pid(pid: u32) {
    if pid == 0 {
        return;
    }

    let pid_str = pid.to_string();
    // Best-effort: SIGTERM then SIGKILL shortly after.
    let _ = std::process::Command::new("kill")
        .args(["-TERM", &pid_str])
        .status();

    let _ = thread::spawn(move || {
        thread::sleep(std::time::Duration::from_millis(750));
        let _ = std::process::Command::new("kill")
            .args(["-KILL", &pid_str])
            .status();
    });
}

#[cfg(not(unix))]
fn terminate_pid(_pid: u32) {}

/// Spawn a new PTY shell session and return the session ID.
#[tauri::command]
pub fn spawn_shell(
    app: AppHandle,
    rows: Option<u16>,
    cols: Option<u16>,
    cwd: Option<String>,
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pty_rows = rows.unwrap_or(24);
    let pty_cols = cols.unwrap_or(80);

    let pair = pty_system
        .openpty(PtySize {
            rows: pty_rows,
            cols: pty_cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let shell = select_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("--login");

    let working_dir = cwd.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string())
    });
    cmd.cwd(&working_dir);

    if let Some(vars) = env_vars {
        for (key, value) in vars {
            cmd.env(key, value);
        }
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let child_id = child.process_id().unwrap_or(0);
    let session_id = Uuid::new_v4().to_string();

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    let session = Arc::new(Mutex::new(PtySession {
        master: pair.master,
        writer,
        child_id,
        cwd: working_dir,
    }));

    let state = app.state::<PtyManager>();
    state
        .sessions
        .lock()
        .insert(session_id.clone(), session.clone());

    let exit_emitted = Arc::new(AtomicBool::new(false));

    // Spawn a reader thread that forwards PTY output to the frontend
    let app_handle = app.clone();
    let sid = session_id.clone();
    let exit_emitted_reader = exit_emitted.clone();
    let _ = thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    emit_pty_exit_once(&app_handle, &sid, exit_emitted_reader.as_ref());
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    #[derive(Clone, serde::Serialize)]
                    struct PtyOutput {
                        session_id: String,
                        data: String,
                    }
                    let _ = app_handle.emit(
                        "pty-output",
                        PtyOutput {
                            session_id: sid.clone(),
                            data,
                        },
                    );
                }
                Err(_) => {
                    emit_pty_exit_once(&app_handle, &sid, exit_emitted_reader.as_ref());
                    break;
                }
            }
        }

        // Clean up session
        if let Some(manager) = app_handle.try_state::<PtyManager>() {
            manager.sessions.lock().remove(&sid);
        }
    });

    // Wait for child exit in another thread
    let app_handle2 = app.clone();
    let sid2 = session_id.clone();
    let exit_emitted_waiter = exit_emitted.clone();
    let _ = thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
        emit_pty_exit_once(&app_handle2, &sid2, exit_emitted_waiter.as_ref());

        if let Some(manager) = app_handle2.try_state::<PtyManager>() {
            manager.sessions.lock().remove(&sid2);
        }
    });

    log::info!("Spawned PTY session: {} (PID: {})", session_id, child_id);
    Ok(session_id)
}

fn select_shell() -> String {
    let fallback = "/bin/zsh".to_string();
    let raw = std::env::var("SHELL").unwrap_or_else(|_| fallback.clone());
    // Only allow known system shells to avoid executing an unexpected binary.
    match raw.as_str() {
        "/bin/zsh" | "/bin/bash" | "/bin/sh" => raw,
        _ => fallback,
    }
}

/// Write data to a PTY session.
#[tauri::command]
pub fn write_to_pty(app: AppHandle, session_id: String, data: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let mut session_lock = session.lock();
    session_lock
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    session_lock
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY writer: {}", e))?;

    Ok(())
}

/// Resize a PTY session.
#[tauri::command]
pub fn resize_pty(app: AppHandle, session_id: String, rows: u16, cols: u16) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let session_lock = session.lock();
    session_lock
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

    Ok(())
}

/// Kill a PTY session.
#[tauri::command]
pub fn kill_pty(app: AppHandle, session_id: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let (pid, removed) = {
        let mut sessions = state.sessions.lock();
        let pid = sessions
            .get(&session_id)
            .map(|s| s.lock().child_id)
            .unwrap_or(0);
        let removed = sessions.remove(&session_id).is_some();
        (pid, removed)
    };

    if !removed {
        return Err(format!("Session {} not found", session_id));
    }

    terminate_pid(pid);
    log::info!("Killed PTY session: {} (PID: {})", session_id, pid);
    Ok(())
}

/// Get the current working directory of a session.
/// On macOS, queries the child process's actual CWD via lsof.
/// Falls back to the stored initial CWD if lookup fails.
#[tauri::command]
pub fn get_cwd(app: AppHandle, session_id: String) -> Result<String, String> {
    let state = app.state::<PtyManager>();
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let session_lock = session.lock();
    let pid = session_lock.child_id;
    let fallback = session_lock.cwd.clone();

    // Try to get the real CWD from the child process
    if pid > 0 {
        if let Some(real_cwd) = get_process_cwd(pid) {
            return Ok(real_cwd);
        }
    }
    Ok(fallback)
}

/// Query the actual CWD of a process.
/// On macOS: uses `lsof -a -p <pid> -d cwd -Fn`
/// On Linux: reads `/proc/<pid>/cwd` symlink
fn get_process_cwd(pid: u32) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("lsof")
            .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        // lsof output format: lines starting with 'n' contain the path
        for line in stdout.lines() {
            if let Some(path) = line.strip_prefix('n') {
                if !path.is_empty() && path.starts_with('/') {
                    return Some(path.to_string());
                }
            }
        }
        None
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_link(format!("/proc/{}/cwd", pid))
            .ok()
            .map(|p| p.to_string_lossy().to_string())
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = pid;
        None
    }
}

/// Get system information for AI context.
#[tauri::command]
pub fn get_system_info() -> Result<serde_json::Value, String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "unknown".to_string());
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let user = std::env::var("USER").unwrap_or_else(|_| "unknown".to_string());

    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86_64"
    };

    Ok(serde_json::json!({
        "os": "macOS",
        "arch": arch,
        "shell": shell,
        "home": home,
        "user": user,
        "term": "xterm-256color",
    }))
}

/// List files and directories in a given path for autocomplete.
/// Returns entries with name, path, and whether they are a directory.
#[tauri::command]
pub fn list_directory(path: String) -> Result<serde_json::Value, String> {
    use std::path::Path;

    // Hide dotfiles by default unless the user explicitly typed a dot prefix.
    // We infer this from the last path component in the *typed* string.
    let typed = path.trim_end_matches('/');
    let last_component = typed.rsplit('/').next().unwrap_or(typed);
    let show_hidden = last_component.starts_with('.');

    let target = if let Some(stripped) = path.strip_prefix('~') {
        let home = dirs::home_dir().ok_or_else(|| "Cannot resolve home directory".to_string())?;
        home.join(stripped.trim_start_matches('/'))
    } else {
        Path::new(&path).to_path_buf()
    };

    if !target.exists() {
        return Ok(serde_json::json!({ "entries": [], "path": path }));
    }

    if !target.is_dir() {
        return Ok(serde_json::json!({ "entries": [], "path": path }));
    }

    struct DirEntry {
        name: String,
        name_lower: String,
        path: String,
        is_dir: bool,
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    match std::fs::read_dir(&target) {
        Ok(read_dir) => {
            for entry in read_dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !show_hidden && name.starts_with('.') {
                    continue;
                }
                // Skip hidden files unless the user explicitly typed a dot prefix
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                let full_path = entry.path().to_string_lossy().to_string();

                entries.push(DirEntry {
                    name_lower: name.to_lowercase(),
                    name,
                    path: full_path,
                    is_dir,
                });
            }
        }
        Err(e) => {
            return Err(format!("Failed to read directory: {}", e));
        }
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name_lower.cmp(&b.name_lower),
    });

    let json_entries: Vec<serde_json::Value> = entries
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "name": e.name,
                "path": e.path,
                "isDir": e.is_dir,
            })
        })
        .collect();

    Ok(serde_json::json!({
        "entries": json_entries,
        "path": target.to_string_lossy().to_string(),
    }))
}
