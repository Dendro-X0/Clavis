use std::io::{Read, Write};

use zeroize::Zeroize;

use crate::crypto::{
    KEY_LEN, KdfParams, MAGIC, NONCE_LEN, SALT_LEN, VERSION, VaultKey, decrypt, derive_key,
    encrypt, random_nonce, random_salt,
};
use crate::error::{Result, VaultError};
use crate::model::VaultDocument;

const HEADER_LEN: usize = MAGIC.len() + 1 + SALT_LEN + 12 + NONCE_LEN;

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

pub fn write_all_atomic(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("km.tmp");
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}
