use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{
    Algorithm, Argon2, Params, Version,
    password_hash::{PasswordHasher, SaltString},
};
use rand::RngCore;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::error::{Result, VaultError};

pub const MAGIC: &[u8] = b"kmvault";
pub const VERSION: u8 = 1;
pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

/// Default Argon2id params (balanced for desktop unlock).
pub const DEFAULT_M_COST: u32 = 19_456; // ~19 MiB
pub const DEFAULT_T_COST: u32 = 2;
pub const DEFAULT_P_COST: u32 = 1;

#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct VaultKey {
    pub bytes: [u8; KEY_LEN],
}

#[derive(Debug, Clone)]
pub struct KdfParams {
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            m_cost: DEFAULT_M_COST,
            t_cost: DEFAULT_T_COST,
            p_cost: DEFAULT_P_COST,
        }
    }
}

pub fn random_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

pub fn random_nonce() -> [u8; NONCE_LEN] {
    let mut nonce = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce);
    nonce
}

pub fn derive_key(password: &str, salt: &[u8], params: &KdfParams) -> Result<VaultKey> {
    let argon_params = Params::new(params.m_cost, params.t_cost, params.p_cost, Some(KEY_LEN))
        .map_err(|e| VaultError::Crypto(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);

    let salt_string =
        SaltString::encode_b64(salt).map_err(|e| VaultError::Crypto(e.to_string()))?;

    let hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| VaultError::Crypto(e.to_string()))?;

    let hash_bytes = hash
        .hash
        .ok_or_else(|| VaultError::Crypto("missing argon2 hash".into()))?;

    let mut key = [0u8; KEY_LEN];
    let raw = hash_bytes.as_bytes();
    if raw.len() < KEY_LEN {
        return Err(VaultError::Crypto("argon2 output too short".into()));
    }
    key.copy_from_slice(&raw[..KEY_LEN]);
    Ok(VaultKey { bytes: key })
}

pub fn encrypt(key: &VaultKey, plaintext: &[u8], nonce: &[u8; NONCE_LEN]) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.bytes));
    let nonce = Nonce::from_slice(nonce);
    cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| VaultError::Crypto(e.to_string()))
}

pub fn decrypt(key: &VaultKey, ciphertext: &[u8], nonce: &[u8; NONCE_LEN]) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.bytes));
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| VaultError::WrongPassword)
}
