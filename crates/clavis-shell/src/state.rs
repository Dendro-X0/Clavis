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

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_seconds: 300,
            clipboard_clear_seconds: 30,
            biometric_unlock: false,
            theme: default_theme(),
            entry_layout: default_entry_layout(),
            page_size: default_page_size(),
            pinned_workspace_ids: Vec::new(),
            fetch_favicons: false,
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
