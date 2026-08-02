use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use vault_core::VaultSession;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_lock_seconds: u64,
    pub clipboard_clear_seconds: u64,
    pub biometric_unlock: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_seconds: 300,
            clipboard_clear_seconds: 30,
            biometric_unlock: false,
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
