use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use zeroize::Zeroize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Login,
    Note,
    Api,
    Custom,
}

impl Default for EntryType {
    fn default() -> Self {
        Self::Login
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustomField {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Entry {
    pub id: String,
    pub entry_type: EntryType,
    pub title: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub custom_fields: Vec<CustomField>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Entry {
    pub fn new(entry_type: EntryType, title: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            entry_type,
            title: title.into(),
            username: String::new(),
            password: String::new(),
            url: String::new(),
            notes: String::new(),
            custom_fields: Vec::new(),
            tags: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Overwrite secret-bearing fields in place (best-effort before drop).
    pub fn scrub_secrets(&mut self) {
        self.password.zeroize();
        self.notes.zeroize();
        for field in &mut self.custom_fields {
            field.value.zeroize();
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultMeta {
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    /// Original import filename/path, used for replace workflows.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub entries: Vec<Entry>,
}

impl Workspace {
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            source_file: None,
            created_at: now,
            updated_at: now,
            entries: Vec::new(),
        }
    }

    pub fn with_entries(name: impl Into<String>, source_file: Option<String>, entries: Vec<Entry>) -> Self {
        let mut ws = Self::new(name);
        ws.source_file = source_file;
        ws.entries = entries;
        ws
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultDocument {
    pub meta: VaultMeta,
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
    #[serde(default)]
    pub active_workspace_id: String,
    /// Legacy flat list from v1 vaults — migrated into a workspace on load.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entries: Vec<Entry>,
}

impl VaultDocument {
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        let personal = Workspace::new("Personal");
        let active = personal.id.clone();
        Self {
            meta: VaultMeta {
                name: name.into(),
                created_at: now,
                updated_at: now,
            },
            workspaces: vec![personal],
            active_workspace_id: active,
            entries: Vec::new(),
        }
    }

    /// Migrate legacy `entries` and ensure a valid active workspace.
    pub fn normalize(&mut self) {
        if self.workspaces.is_empty() {
            let mut ws = Workspace::new("Personal");
            if !self.entries.is_empty() {
                ws.entries = std::mem::take(&mut self.entries);
            }
            self.active_workspace_id = ws.id.clone();
            self.workspaces.push(ws);
        } else if !self.entries.is_empty() {
            // Merge leftover legacy entries into first workspace once.
            let first = &mut self.workspaces[0];
            first.entries.append(&mut self.entries);
            first.updated_at = Utc::now();
        }

        self.entries.clear();

        if !self
            .workspaces
            .iter()
            .any(|w| w.id == self.active_workspace_id)
        {
            self.active_workspace_id = self.workspaces[0].id.clone();
        }
    }

    pub fn active_workspace(&self) -> Option<&Workspace> {
        self.workspaces
            .iter()
            .find(|w| w.id == self.active_workspace_id)
    }

    pub fn active_workspace_mut(&mut self) -> Option<&mut Workspace> {
        let id = self.active_workspace_id.clone();
        self.workspaces.iter_mut().find(|w| w.id == id)
    }

    pub fn workspace(&self, id: &str) -> Option<&Workspace> {
        self.workspaces.iter().find(|w| w.id == id)
    }

    pub fn workspace_mut(&mut self, id: &str) -> Option<&mut Workspace> {
        self.workspaces.iter_mut().find(|w| w.id == id)
    }

    /// Scrub passwords / notes / custom values across all workspaces (and legacy entries).
    pub fn scrub_secrets(&mut self) {
        for ws in &mut self.workspaces {
            for entry in &mut ws.entries {
                entry.scrub_secrets();
            }
        }
        for entry in &mut self.entries {
            entry.scrub_secrets();
        }
    }
}
