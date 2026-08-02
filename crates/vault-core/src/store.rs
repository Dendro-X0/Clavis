use std::path::{Path, PathBuf};

use chrono::Utc;
use zeroize::Zeroize;

use crate::crypto::{KdfParams, VaultKey};
use crate::error::{Result, VaultError};
use crate::format::{
    decode_vault, encode_vault, encode_vault_with_key, read_all, write_all_atomic,
};
use crate::model::{Entry, VaultDocument};

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
        document: VaultDocument,
        key: VaultKey,
        salt: [u8; crate::crypto::SALT_LEN],
        params: KdfParams,
    ) -> Self {
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
        self.document.entries.len()
    }

    pub fn list_entries(&self) -> &[Entry] {
        &self.document.entries
    }

    pub fn get_entry(&self, id: &str) -> Result<&Entry> {
        self.document
            .entries
            .iter()
            .find(|e| e.id == id)
            .ok_or_else(|| VaultError::EntryNotFound(id.to_string()))
    }

    pub fn upsert_entry(&mut self, mut entry: Entry) -> Result<Entry> {
        entry.updated_at = Utc::now();
        if let Some(existing) = self
            .document
            .entries
            .iter_mut()
            .find(|e| e.id == entry.id)
        {
            entry.created_at = existing.created_at;
            *existing = entry.clone();
        } else {
            if entry.created_at.timestamp() == 0 {
                entry.created_at = entry.updated_at;
            }
            self.document.entries.push(entry.clone());
        }
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(entry)
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<()> {
        let before = self.document.entries.len();
        self.document.entries.retain(|e| e.id != id);
        if self.document.entries.len() == before {
            return Err(VaultError::EntryNotFound(id.to_string()));
        }
        self.document.meta.updated_at = Utc::now();
        self.persist()?;
        Ok(())
    }

    pub fn change_password(&mut self, current: &str, new_password: &str) -> Result<()> {
        // Verify current password still opens the file.
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

    pub fn replace_document(&mut self, document: VaultDocument) -> Result<()> {
        self.document = document;
        self.document.meta.updated_at = Utc::now();
        self.persist()
    }

    pub fn into_locked(self) {
        // Drop zeroizes key via ZeroizeOnDrop.
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
    let (document, key, salt, params) = decode_vault(&bytes, password)?;
    Ok(VaultSession {
        path: path.to_path_buf(),
        document,
        key,
        salt,
        params,
    })
}
