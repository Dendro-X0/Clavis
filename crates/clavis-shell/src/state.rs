use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use vault_core::VaultSession;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_lock_seconds: u64,
    pub clipboard_clear_seconds: u64,
    pub biometric_unlock: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_entry_layout")]
    pub entry_layout: String,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[serde(default)]
    pub pinned_workspace_ids: Vec<String>,
    #[serde(default)]
    pub fetch_favicons: bool,
    /// Master outbound HTTP gate (favicon fetch, etc.). Default off = offline-first.
    #[serde(default)]
    pub allow_network: bool,
    /// Lock when the app document becomes hidden (tab switch / minimize / background).
    #[serde(default = "default_lock_on_hide")]
    pub lock_on_hide: bool,
    /// SHA-256 hex of encrypted `vault.km` after last trusted unlock/persist (integrity signal).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_vault_sha256: Option<String>,
}

fn default_theme() -> String {
    "system".into()
}

fn default_entry_layout() -> String {
    "list".into()
}

fn default_page_size() -> u32 {
    25
}

fn default_lock_on_hide() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_seconds: 300,
            clipboard_clear_seconds: 15,
            biometric_unlock: false,
            theme: default_theme(),
            entry_layout: default_entry_layout(),
            page_size: default_page_size(),
            pinned_workspace_ids: Vec::new(),
            fetch_favicons: false,
            allow_network: false,
            lock_on_hide: default_lock_on_hide(),
            last_vault_sha256: None,
        }
    }
}

pub struct AppState {
    pub session: Mutex<Option<VaultSession>>,
    pub settings: Mutex<AppSettings>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            settings: Mutex::new(AppSettings::default()),
        }
    }
}
