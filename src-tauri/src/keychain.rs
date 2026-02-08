use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "com.aiterminal.app";

/// Store an API key in macOS Keychain.
#[tauri::command]
pub fn store_api_key(provider: String, api_key: String) -> Result<(), String> {
    // Delete existing entry first (if any) to avoid conflicts
    let _ = delete_generic_password(SERVICE_NAME, &provider);

    set_generic_password(SERVICE_NAME, &provider, api_key.as_bytes())
        .map_err(|e| format!("Failed to store API key for {}: {}", provider, e))?;

    log::info!("Stored API key for provider: {}", provider);
    Ok(())
}

/// Retrieve an API key from macOS Keychain.
#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    match get_generic_password(SERVICE_NAME, &provider) {
        Ok(bytes) => {
            let key = String::from_utf8(bytes.to_vec())
                .map_err(|e| format!("Invalid UTF-8 in stored key: {}", e))?;
            Ok(Some(key))
        }
        Err(e) => {
            let err_str = e.to_string();
            // errSecItemNotFound (-25300) means no key stored — not an error
            if err_str.contains("-25300") || err_str.contains("not found") {
                Ok(None)
            } else {
                Err(format!(
                    "Failed to retrieve API key for {}: {}",
                    provider, e
                ))
            }
        }
    }
}

/// Delete an API key from macOS Keychain.
#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    delete_generic_password(SERVICE_NAME, &provider)
        .map_err(|e| format!("Failed to delete API key for {}: {}", provider, e))?;

    log::info!("Deleted API key for provider: {}", provider);
    Ok(())
}
