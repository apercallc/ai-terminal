use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

#[cfg(unix)]
use std::fs::Permissions;

/// A single log entry for an executed command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub command: String,
    pub source: LogSource,
    pub risk_level: RiskLevel,
    pub approved: bool,
    pub exit_code: Option<i32>,
    pub output_preview: Option<String>,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogSource {
    User,
    Ai,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Critical,
}

fn get_log_dir() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    let log_dir = base.join("com.aiterminal.app").join("logs");
    fs::create_dir_all(&log_dir).ok();

    #[cfg(unix)]
    {
        let _ = fs::set_permissions(&log_dir, Permissions::from_mode(0o700));
    }

    log_dir
}

fn get_log_file_path() -> PathBuf {
    let now = Utc::now();
    let filename = format!("audit-{}.jsonl", now.format("%Y-%m-%d"));
    get_log_dir().join(filename)
}

/// Write a command log entry to the audit log.
#[tauri::command]
pub fn write_log(
    command: String,
    source: String,
    risk_level: String,
    approved: bool,
    exit_code: Option<i32>,
    output_preview: Option<String>,
    session_id: String,
) -> Result<(), String> {
    let src = match source.as_str() {
        "ai" => LogSource::Ai,
        "system" => LogSource::System,
        _ => LogSource::User,
    };

    let risk = match risk_level.as_str() {
        "low" => RiskLevel::Low,
        "medium" => RiskLevel::Medium,
        "high" => RiskLevel::High,
        "critical" => RiskLevel::Critical,
        _ => RiskLevel::Safe,
    };

    let entry = LogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        command,
        source: src,
        risk_level: risk,
        approved,
        exit_code,
        output_preview,
        session_id,
    };

    let json = serde_json::to_string(&entry)
        .map_err(|e| format!("Failed to serialize log entry: {}", e))?;

    let log_path = get_log_file_path();
    let mut options = OpenOptions::new();
    options.create(true).append(true);

    #[cfg(unix)]
    {
        options.mode(0o600);
    }

    let mut file = options
        .open(&log_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    writeln!(file, "{}", json).map_err(|e| format!("Failed to write log entry: {}", e))?;

    Ok(())
}

/// Get log entries, optionally filtered by date and session.
#[tauri::command]
pub fn get_log_entries(
    date: Option<String>,
    session_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let log_dir = get_log_dir();
    let mut entries: VecDeque<LogEntry> = VecDeque::new();
    let max_entries = limit.unwrap_or(usize::MAX);

    let target_date = date.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());
    let log_path = log_dir.join(format!("audit-{}.jsonl", target_date));

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&log_path).map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read log file: {}", e))?;
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<LogEntry>(&line) {
            if let Some(ref sid) = session_id {
                if &entry.session_id != sid {
                    continue;
                }
            }

            entries.push_back(entry);
            if max_entries != usize::MAX && entries.len() > max_entries {
                entries.pop_front();
            }
        }
    }

    // The JSONL file is chronological; return most recent first.
    let mut out: Vec<LogEntry> = entries.into_iter().collect();
    out.reverse();
    Ok(out)
}

/// Get all available log dates (for browsing history).
#[tauri::command]
pub fn get_log_dates() -> Result<Vec<String>, String> {
    let log_dir = get_log_dir();
    let mut dates: Vec<String> = Vec::new();

    if let Ok(dir_entries) = fs::read_dir(&log_dir) {
        for entry in dir_entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("audit-") && name.ends_with(".jsonl") {
                let date = name
                    .strip_prefix("audit-")
                    .unwrap_or("")
                    .strip_suffix(".jsonl")
                    .unwrap_or("");
                if !date.is_empty() {
                    dates.push(date.to_string());
                }
            }
        }
    }

    dates.sort();
    dates.reverse();
    Ok(dates)
}
