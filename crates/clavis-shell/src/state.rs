use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use vault_core::VaultSession;
use zeroize::Zeroize;

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
    /// Soft-deleted entries older than this many days are purged on unlock.
    #[serde(default = "default_trash_retain_days")]
    pub trash_retain_days: u64,
    /// Opt-in HIBP k-anonymity checks (also requires `allow_network`). Default off.
    #[serde(default)]
    pub check_breaches: bool,
    /// Desktop: allow confirm-gated SendInput autotype (Windows). Default off.
    #[serde(default)]
    pub autotype_enabled: bool,
    /// Desktop: suggest entries from foreground window title. Default off.
    #[serde(default)]
    pub suggest_from_foreground: bool,
    /// Delay between autotype keystrokes (ms).
    #[serde(default = "default_autotype_key_delay_ms")]
    pub autotype_key_delay_ms: u64,
    /// Max dated vault snapshots to keep under data/snapshots.
    #[serde(default = "default_snapshot_retain")]
    pub snapshot_retain: u32,
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

fn default_trash_retain_days() -> u64 {
    30
}

fn default_autotype_key_delay_ms() -> u64 {
    25
}

fn default_snapshot_retain() -> u32 {
    10
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
            trash_retain_days: default_trash_retain_days(),
            check_breaches: false,
            autotype_enabled: false,
            suggest_from_foreground: false,
            autotype_key_delay_ms: default_autotype_key_delay_ms(),
            snapshot_retain: default_snapshot_retain(),
            last_vault_sha256: None,
        }
    }
}

/// Session-only ring of generated passwords (not persisted).
const GENERATOR_HISTORY_CAP: usize = 5;

pub struct AppState {
    pub session: Mutex<Option<VaultSession>>,
    pub settings: Mutex<AppSettings>,
    pub generator_history: Mutex<Vec<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            settings: Mutex::new(AppSettings::default()),
            generator_history: Mutex::new(Vec::new()),
        }
    }
}

impl AppState {
    pub fn clear_generator_history(&self) {
        if let Ok(mut hist) = self.generator_history.lock() {
            for s in hist.iter_mut() {
                s.zeroize();
            }
            hist.clear();
        }
    }

    pub fn push_generator_history(&self, password: &str) {
        if let Ok(mut hist) = self.generator_history.lock() {
            hist.push(password.to_string());
            while hist.len() > GENERATOR_HISTORY_CAP {
                let mut old = hist.remove(0);
                old.zeroize();
            }
        }
    }
}
