use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultMeta {
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultDocument {
    pub meta: VaultMeta,
    pub entries: Vec<Entry>,
}

impl VaultDocument {
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            meta: VaultMeta {
                name: name.into(),
                created_at: now,
                updated_at: now,
            },
            entries: Vec::new(),
        }
    }
}
