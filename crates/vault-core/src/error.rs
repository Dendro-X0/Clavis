use thiserror::Error;

pub type Result<T> = std::result::Result<T, VaultError>;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault file not found")]
    NotFound,
    #[error("invalid vault file format")]
    InvalidFormat,
    #[error("unsupported vault version: {0}")]
    UnsupportedVersion(u8),
    #[error("incorrect master password")]
    WrongPassword,
    #[error("vault is locked")]
    Locked,
    #[error("entry not found: {0}")]
    EntryNotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("crypto error: {0}")]
    Crypto(String),
    #[error("csv error: {0}")]
    Csv(String),
    #[error("{0}")]
    Message(String),
}
