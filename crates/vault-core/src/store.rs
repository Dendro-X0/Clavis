use std::path::{Path, PathBuf};

use chrono::Utc;
use zeroize::Zeroize;

use crate::crypto::{KdfParams, VaultKey};
use crate::error::{Result, VaultError};
use crate::format::{
    decode_vault, encode_vault, encode_vault_with_key, read_all, write_all_atomic,
};
use crate::model::{Entry, VaultDocument, Workspace};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultStatus {
    Missing,
    Locked,
    Unlocked { entry_count: usize, name: String },
}

pub struct VaultSession {
    path: PathBuf,
    document: VaultDocument,
    key: VaultKey,
    salt: [u8; crate::crypto::SALT_LEN],
    params: KdfParams,
}

impl VaultSession {
    pub(crate) fn from_parts(
        path: PathBuf,
        mut document: VaultDocument,
        key: VaultKey,
        salt: [u8; crate::crypto::SALT_LEN],
        params: KdfParams,
    ) -> Self {
        document.normalize();
        Self {
            path,
            document,
            key,
            salt,
            params,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn document(&self) -> &VaultDocument {
        &self.document
    }

    pub fn entry_count(&self) -> usize {
        self.document
            .active_workspace()
            .map(|w| w.entries.len())
            .unwrap_or(0)
    }

    pub fn list_workspaces(&self) -> &[Workspace] {
        &self.document.workspaces
    }

    pub fn active_workspace_id(&self) -> &str {
        &self.document.active_workspace_id
    }

    pub fn set_active_workspace(&mut self, id: &str) -> Result<()> {
        if !self.document.workspaces.iter().any(|w| w.id == id) {
            return Err(VaultError::Message("workspace not found".into()));
        }
        self.document.active_workspace_id = id.to_string();
        self.document.meta.updated_at = Utc::now();
        self.persist()
    }

    pub fn create_workspace(&mut self, name: &str) -> Result<Workspace> {
        let name = name.trim();
        if name.is_empty() {
            return Err(VaultError::Message("workspace name must not be empty".into()));
        }
        let ws = Workspace::new(name);
        self.document.active_workspace_id = ws.id.clone();
        self.document.workspaces.push(ws.clone());
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(ws)
    }

    pub fn rename_workspace(&mut self, id: &str, name: &str) -> Result<Workspace> {
        let name = name.trim();
        if name.is_empty() {
            return Err(VaultError::Message("workspace name must not be empty".into()));
        }
        let ws = self
            .document
            .workspace_mut(id)
            .ok_or_else(|| VaultError::Message("workspace not found".into()))?;
        ws.name = name.to_string();
        ws.updated_at = Utc::now();
        let out = ws.clone();
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(out)
    }

    pub fn delete_workspace(&mut self, id: &str) -> Result<()> {
        if self.document.workspaces.len() <= 1 {
            return Err(VaultError::Message(
                "cannot delete the last workspace".into(),
            ));
        }
        let before = self.document.workspaces.len();
        self.document.workspaces.retain(|w| w.id != id);
        if self.document.workspaces.len() == before {
            return Err(VaultError::Message("workspace not found".into()));
        }
        if self.document.active_workspace_id == id {
            self.document.active_workspace_id = self.document.workspaces[0].id.clone();
        }
        self.document.meta.updated_at = Utc::now();
        self.persist()
    }

    /// Merge `source_id` into `target_id` (append entries), then delete source.
    pub fn merge_workspace_into(&mut self, target_id: &str, source_id: &str) -> Result<Workspace> {
        if target_id == source_id {
            return Err(VaultError::Message("cannot merge a workspace into itself".into()));
        }
        let source_entries = {
            let source = self
                .document
                .workspace(source_id)
                .ok_or_else(|| VaultError::Message("source workspace not found".into()))?;
            source.entries.clone()
        };
        {
            let target = self
                .document
                .workspace_mut(target_id)
                .ok_or_else(|| VaultError::Message("target workspace not found".into()))?;
            target.entries.extend(source_entries);
            target.updated_at = Utc::now();
        }
        self.delete_workspace(source_id)?;
        self.document.active_workspace_id = target_id.to_string();
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        let out = self
            .document
            .workspace(target_id)
            .cloned()
            .ok_or_else(|| VaultError::Message("target workspace not found".into()))?;
        Ok(out)
    }

    /// Merge workspaces that share the same name (case-insensitive).
    /// Keeps the largest (entry count), then active, then first; returns how many were removed.
    pub fn merge_duplicate_workspaces(&mut self) -> Result<usize> {
        use std::collections::HashMap;
        let mut by_name: HashMap<String, Vec<(String, usize, bool)>> = HashMap::new();
        let active = self.document.active_workspace_id.clone();
        for w in &self.document.workspaces {
            let key = w.name.trim().to_ascii_lowercase();
            by_name.entry(key).or_default().push((
                w.id.clone(),
                w.entries.len(),
                w.id == active,
            ));
        }
        let mut removed = 0usize;
        let groups: Vec<Vec<(String, usize, bool)>> = by_name
            .into_values()
            .filter(|g| g.len() > 1)
            .collect();
        for mut group in groups {
            group.sort_by(|a, b| {
                b.1.cmp(&a.1)
                    .then_with(|| b.2.cmp(&a.2))
                    .then_with(|| a.0.cmp(&b.0))
            });
            let keep = group[0].0.clone();
            for (id, _, _) in group.into_iter().skip(1) {
                self.merge_workspace_into(&keep, &id)?;
                removed += 1;
            }
        }
        Ok(removed)
    }

    /// Create a dedicated workspace from an imported file and make it active.
    pub fn import_as_workspace(
        &mut self,
        name: &str,
        source_file: Option<String>,
        entries: Vec<Entry>,
    ) -> Result<Workspace> {
        let name = name.trim();
        if name.is_empty() {
            return Err(VaultError::Message("workspace name must not be empty".into()));
        }
        let ws = Workspace::with_entries(name, source_file, entries);
        self.document.active_workspace_id = ws.id.clone();
        self.document.workspaces.push(ws.clone());
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(ws)
    }

    /// Find a workspace by name (case-insensitive, trimmed).
    /// Prefers the active workspace when names collide.
    pub fn find_workspace_id_by_name(&self, name: &str) -> Option<String> {
        let needle = name.trim();
        if needle.is_empty() {
            return None;
        }
        if let Some(active) = self.document.active_workspace() {
            if active.name.eq_ignore_ascii_case(needle) {
                return Some(active.id.clone());
            }
        }
        self.document
            .workspaces
            .iter()
            .find(|w| w.name.eq_ignore_ascii_case(needle))
            .map(|w| w.id.clone())
    }

    /// Replace all entries in a workspace (re-import / replace list).
    pub fn replace_workspace_entries(
        &mut self,
        id: &str,
        entries: Vec<Entry>,
        source_file: Option<String>,
    ) -> Result<Workspace> {
        let ws = self
            .document
            .workspace_mut(id)
            .ok_or_else(|| VaultError::Message("workspace not found".into()))?;
        ws.entries = entries;
        if source_file.is_some() {
            ws.source_file = source_file;
        }
        ws.updated_at = Utc::now();
        let out = ws.clone();
        self.document.active_workspace_id = out.id.clone();
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(out)
    }

    pub fn list_entries(&self) -> Result<&[Entry]> {
        self.document
            .active_workspace()
            .map(|w| w.entries.as_slice())
            .ok_or_else(|| VaultError::Message("no active workspace".into()))
    }

    /// All entries across workspaces: `(workspace_id, workspace_name, entry)`.
    pub fn list_all_entries(&self) -> Vec<(&str, &str, &Entry)> {
        let mut out = Vec::new();
        for ws in &self.document.workspaces {
            for entry in &ws.entries {
                out.push((ws.id.as_str(), ws.name.as_str(), entry));
            }
        }
        out
    }

    pub fn get_entry(&self, id: &str) -> Result<&Entry> {
        for ws in &self.document.workspaces {
            if let Some(entry) = ws.entries.iter().find(|e| e.id == id) {
                return Ok(entry);
            }
        }
        Err(VaultError::EntryNotFound(id.to_string()))
    }

    pub fn upsert_entry(&mut self, mut entry: Entry) -> Result<Entry> {
        entry.updated_at = Utc::now();
        let ws = self
            .document
            .active_workspace_mut()
            .ok_or_else(|| VaultError::Message("no active workspace".into()))?;
        if let Some(existing) = ws.entries.iter_mut().find(|e| e.id == entry.id) {
            entry.created_at = existing.created_at;
            *existing = entry.clone();
        } else {
            if entry.created_at.timestamp() == 0 {
                entry.created_at = entry.updated_at;
            }
            ws.entries.push(entry.clone());
        }
        ws.updated_at = Utc::now();
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(entry)
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<()> {
        let ws = self
            .document
            .active_workspace_mut()
            .ok_or_else(|| VaultError::Message("no active workspace".into()))?;
        let before = ws.entries.len();
        ws.entries.retain(|e| e.id != id);
        if ws.entries.len() == before {
            return Err(VaultError::EntryNotFound(id.to_string()));
        }
        ws.updated_at = Utc::now();
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(())
    }

    pub fn change_password(&mut self, current: &str, new_password: &str) -> Result<()> {
        let bytes = read_all(&self.path)?;
        let _ = decode_vault(&bytes, current)?;
        let params = KdfParams::default();
        let salt = crate::crypto::random_salt();
        let key = crate::crypto::derive_key(new_password, &salt, &params)?;
        let encoded = encode_vault_with_key(&self.document, &key, salt, &params)?;
        write_all_atomic(&self.path, &encoded)?;
        self.key = key;
        self.salt = salt;
        self.params = params;
        Ok(())
    }

    pub fn persist(&self) -> Result<()> {
        let encoded = encode_vault_with_key(&self.document, &self.key, self.salt, &self.params)?;
        write_all_atomic(&self.path, &encoded)
    }

    pub fn replace_document(&mut self, mut document: VaultDocument) -> Result<()> {
        document.normalize();
        self.document = document;
        self.document.meta.updated_at = Utc::now();
        self.persist()
    }

    pub fn into_locked(self) {
        drop(self);
    }
}

impl Drop for VaultSession {
    fn drop(&mut self) {
        self.key.bytes.zeroize();
    }
}

pub fn vault_exists(path: &Path) -> bool {
    path.is_file()
}

pub fn create_vault(path: &Path, name: &str, password: &str) -> Result<VaultSession> {
    if path.exists() {
        return Err(VaultError::Message(
            "vault already exists at data path".into(),
        ));
    }
    if password.trim().is_empty() {
        return Err(VaultError::Message(
            "master password must not be empty".into(),
        ));
    }
    let params = KdfParams::default();
    let document = VaultDocument::new(name);
    let encoded = encode_vault(&document, password, &params)?;
    write_all_atomic(path, &encoded)?;
    open_vault_file(path, password)
}

pub fn open_vault_file(path: &Path, password: &str) -> Result<VaultSession> {
    if !path.is_file() {
        return Err(VaultError::NotFound);
    }
    let bytes = read_all(path)?;
    let (mut document, key, salt, params) = decode_vault(&bytes, password)?;
    document.normalize();
    let session = VaultSession {
        path: path.to_path_buf(),
        document,
        key,
        salt,
        params,
    };
    // Persist migration if legacy flat entries were moved into workspaces.
    session.persist()?;
    Ok(session)
}
