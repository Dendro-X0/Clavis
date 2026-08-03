use std::io::{Read, Write};

use zeroize::Zeroize;

use crate::crypto::{
    DEFAULT_M_COST, DEFAULT_P_COST, DEFAULT_T_COST, KEY_LEN, KdfParams, MAGIC, NONCE_LEN,
    SALT_LEN, VERSION, VaultKey, decrypt, derive_key, encrypt, random_nonce, random_salt,
};
use crate::error::{Result, VaultError};
use crate::model::VaultDocument;
use serde::Serialize;

const HEADER_LEN: usize = MAGIC.len() + 1 + SALT_LEN + 12 + NONCE_LEN;

/// Public summary of vault crypto (safe to show in UI; no secrets).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultCryptoInfo {
    pub algorithm: String,
    pub aead: String,
    pub version: u8,
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl VaultCryptoInfo {
    pub fn argon2id(version: u8, params: &KdfParams) -> Self {
        Self {
            algorithm: "argon2id".into(),
            aead: "aes-256-gcm".into(),
            version,
            m_cost: params.m_cost,
            t_cost: params.t_cost,
            p_cost: params.p_cost,
        }
    }

    pub fn defaults() -> Self {
        Self::argon2id(VERSION, &KdfParams::default())
    }

    /// Memory parameter in MiB (Argon2 m_cost is KiB).
    pub fn memory_mib(&self) -> f64 {
        f64::from(self.m_cost) / 1024.0
    }

    /// True if any cost is below the app default (weaker or unequal).
    pub fn is_weaker_than_defaults(&self) -> bool {
        self.m_cost < DEFAULT_M_COST
            || self.t_cost < DEFAULT_T_COST
            || self.p_cost < DEFAULT_P_COST
    }
}

pub struct EncodedVault {
    pub salt: [u8; SALT_LEN],
    pub params: KdfParams,
    pub nonce: [u8; NONCE_LEN],
    pub ciphertext: Vec<u8>,
}

pub fn encode_vault(doc: &VaultDocument, password: &str, params: &KdfParams) -> Result<Vec<u8>> {
    let salt = random_salt();
    let key = derive_key(password, &salt, params)?;
    let mut plaintext = serde_json::to_vec(doc)?;
    let nonce = random_nonce();
    let ciphertext = encrypt(&key, &plaintext, &nonce)?;
    plaintext.zeroize();
    write_blob(&EncodedVault {
        salt,
        params: params.clone(),
        nonce,
        ciphertext,
    })
}

pub fn encode_vault_with_key(
    doc: &VaultDocument,
    key: &VaultKey,
    salt: [u8; SALT_LEN],
    params: &KdfParams,
) -> Result<Vec<u8>> {
    let mut plaintext = serde_json::to_vec(doc)?;
    let nonce = random_nonce();
    let ciphertext = encrypt(key, &plaintext, &nonce)?;
    plaintext.zeroize();
    write_blob(&EncodedVault {
        salt,
        params: params.clone(),
        nonce,
        ciphertext,
    })
}

pub fn decode_vault(
    bytes: &[u8],
    password: &str,
) -> Result<(VaultDocument, VaultKey, [u8; SALT_LEN], KdfParams)> {
    let encoded = read_blob(bytes)?;
    let key = derive_key(password, &encoded.salt, &encoded.params)?;
    let mut plaintext = decrypt(&key, &encoded.ciphertext, &encoded.nonce)?;
    let doc: VaultDocument = match serde_json::from_slice(&plaintext) {
        Ok(doc) => doc,
        Err(e) => {
            plaintext.zeroize();
            return Err(e.into());
        }
    };
    plaintext.zeroize();
    Ok((doc, key, encoded.salt, encoded.params))
}

pub fn write_blob(encoded: &EncodedVault) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(HEADER_LEN + encoded.ciphertext.len());
    out.write_all(MAGIC)?;
    out.write_all(&[VERSION])?;
    out.write_all(&encoded.salt)?;
    out.write_all(&encoded.params.m_cost.to_le_bytes())?;
    out.write_all(&encoded.params.t_cost.to_le_bytes())?;
    out.write_all(&encoded.params.p_cost.to_le_bytes())?;
    out.write_all(&encoded.nonce)?;
    out.write_all(&encoded.ciphertext)?;
    Ok(out)
}

pub fn read_blob(bytes: &[u8]) -> Result<EncodedVault> {
    if bytes.len() < HEADER_LEN {
        return Err(VaultError::InvalidFormat);
    }
    if &bytes[..MAGIC.len()] != MAGIC {
        return Err(VaultError::InvalidFormat);
    }
    let version = bytes[MAGIC.len()];
    if version != VERSION {
        return Err(VaultError::UnsupportedVersion(version));
    }
    let mut offset = MAGIC.len() + 1;
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&bytes[offset..offset + SALT_LEN]);
    offset += SALT_LEN;

    let m_cost = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    offset += 4;
    let t_cost = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    offset += 4;
    let p_cost = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    offset += 4;

    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[offset..offset + NONCE_LEN]);
    offset += NONCE_LEN;

    let ciphertext = bytes[offset..].to_vec();
    if ciphertext.is_empty() {
        return Err(VaultError::InvalidFormat);
    }

    Ok(EncodedVault {
        salt,
        params: KdfParams {
            m_cost,
            t_cost,
            p_cost,
        },
        nonce,
        ciphertext,
    })
}

/// Parse KDF/AEAD metadata from an encoded vault blob (no password, no decrypt).
pub fn peek_kdf_from_bytes(bytes: &[u8]) -> Result<VaultCryptoInfo> {
    let encoded = read_blob(bytes)?;
    Ok(VaultCryptoInfo::argon2id(VERSION, &encoded.params))
}

/// Parse KDF/AEAD metadata from a vault or backup file on disk.
pub fn peek_kdf_from_path(path: &std::path::Path) -> Result<VaultCryptoInfo> {
    let bytes = read_all(path)?;
    peek_kdf_from_bytes(&bytes)
}

#[allow(dead_code)]
pub fn header_key_len() -> usize {
    KEY_LEN
}

pub fn read_all(path: &std::path::Path) -> Result<Vec<u8>> {
    let mut file = std::fs::File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

/// Sibling temp path: `vault.km` → `vault.km.tmp`.
pub fn atomic_temp_path(path: &std::path::Path) -> std::path::PathBuf {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("vault.km");
    path.with_file_name(format!("{name}.tmp"))
}

/// Sibling crash-recovery backup used on Windows replace: `vault.km` → `vault.km.bak`.
pub fn atomic_backup_path(path: &std::path::Path) -> std::path::PathBuf {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("vault.km");
    path.with_file_name(format!("{name}.bak"))
}

/// Remove leftover `*.tmp` / `*.bak` from an interrupted atomic write.
pub fn cleanup_orphan_temps(path: &std::path::Path) {
    let tmp = atomic_temp_path(path);
    let bak = atomic_backup_path(path);
    let _ = std::fs::remove_file(&tmp);
    let _ = std::fs::remove_file(&bak);
}

fn sync_parent_dir(path: &std::path::Path) {
    let Some(parent) = path.parent() else {
        return;
    };
    if parent.as_os_str().is_empty() {
        return;
    }
    if let Ok(dir) = std::fs::File::open(parent) {
        let _ = dir.sync_all();
    }
}

/// Replace `path` with contents of `tmp`, then remove `tmp`.
///
/// - Unix: `rename` replaces atomically.
/// - Windows: rename cannot overwrite — move existing aside to `.bak`, rename tmp into
///   place, then delete `.bak`. On failure after the aside-move, restore from `.bak`.
fn replace_file(tmp: &std::path::Path, path: &std::path::Path) -> Result<()> {
    #[cfg(unix)]
    {
        std::fs::rename(tmp, path)?;
        Ok(())
    }

    #[cfg(windows)]
    {
        let bak = atomic_backup_path(path);
        let _ = std::fs::remove_file(&bak);
        if path.exists() {
            std::fs::rename(path, &bak)?;
        }
        match std::fs::rename(tmp, path) {
            Ok(()) => {
                let _ = std::fs::remove_file(&bak);
                Ok(())
            }
            Err(e) => {
                let _ = std::fs::rename(&bak, path);
                let _ = std::fs::remove_file(tmp);
                Err(e.into())
            }
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        std::fs::rename(tmp, path)?;
        Ok(())
    }
}

/// Write `bytes` to `path` via temp file + fsync + replace (crash-safe for the final name).
pub fn write_all_atomic(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let tmp = atomic_temp_path(path);
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    replace_file(&tmp, path)?;
    sync_parent_dir(path);
    Ok(())
}
