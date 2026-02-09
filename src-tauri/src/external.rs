use url::Url;

const ALLOWED_HOSTS: &[&str] = &[
    "apercallc.com",
    "www.apercallc.com",
    "github.com",
    "www.github.com",
];

fn is_allowed_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    ALLOWED_HOSTS.iter().any(|h| *h == host)
}

/// Open a URL in the user's default browser.
///
/// Security:
/// - Only allows https:// URLs.
/// - Enforces a host allowlist to avoid exfil/phishing primitives.
/// - Uses platform openers without invoking a shell.
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;

    if parsed.scheme() != "https" {
        return Err("Only https:// URLs are allowed".to_string());
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "URL host is required".to_string())?;

    if !is_allowed_host(host) {
        return Err("Blocked external URL host".to_string());
    }

    // Never spawn a shell; call the platform opener directly.
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg(parsed.as_str())
            .status()
            .map_err(|e| format!("Failed to open URL: {e}"))?
            .success()
            .then_some(())
            .ok_or_else(|| "Failed to open URL".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = parsed;
        Err("open_external_url is only supported on macOS".to_string())
    }
}
