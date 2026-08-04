//! Offline TOTP (SHA-1, 6 digits, 30s) for entry otp_secret fields.

use std::time::{SystemTime, UNIX_EPOCH};

use totp_rs::{Algorithm, Secret, TOTP};
use zeroize::Zeroize;

use crate::error::{Result, VaultError};

pub const TOTP_DIGITS: usize = 6;
pub const TOTP_PERIOD: u64 = 30;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TotpCode {
    pub code: String,
    pub seconds_remaining: u64,
}

/// Normalize raw Base32 or `otpauth://totp/...` into a scrubbed Base32 secret string.
pub fn normalize_otp_secret(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.to_ascii_lowercase().starts_with("otpauth://") {
        return parse_otpauth_uri(trimmed);
    }
    decode_base32_secret(trimmed)?;
    Ok(trimmed.chars().filter(|c| !c.is_whitespace() && *c != '-').collect::<String>().to_uppercase())
}

/// Extract Base32 secret from an otpauth URI (TOTP only).
pub fn parse_otpauth_uri(uri: &str) -> Result<String> {
    let totp = TOTP::from_url_unchecked(uri).map_err(|e| VaultError::Message(format!("otpauth: {e}")))?;
    if totp.algorithm != Algorithm::SHA1 {
        // Still accept secret; codes use SHA-1 defaults for v0.8.0 generation.
    }
    let secret = totp.get_secret_base32();
    if secret.is_empty() {
        return Err(VaultError::Message("otpauth missing secret".into()));
    }
    Ok(secret)
}

fn decode_base32_secret(raw: &str) -> Result<Vec<u8>> {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect::<String>()
        .to_uppercase();
    Secret::Encoded(cleaned)
        .to_bytes()
        .map_err(|e| VaultError::Message(format!("invalid TOTP secret: {e}")))
}

fn build_totp(secret_b32: &str) -> Result<TOTP> {
    let bytes = decode_base32_secret(secret_b32)?;
    // Many authenticator apps still use 80-bit seeds; accept them (matches otpauth imports).
    Ok(TOTP::new_unchecked(
        Algorithm::SHA1,
        TOTP_DIGITS,
        1,
        TOTP_PERIOD,
        bytes,
        None,
        String::new(),
    ))
}

/// Generate current TOTP code for a Base32 secret (or otpauth URI).
pub fn generate_totp_now(secret_or_uri: &str) -> Result<TotpCode> {
    let mut secret = normalize_otp_secret(secret_or_uri)?;
    if secret.is_empty() {
        return Err(VaultError::Message("no TOTP secret".into()));
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| VaultError::Message(e.to_string()))?
        .as_secs();
    let code = generate_totp_at(&secret, now);
    secret.zeroize();
    code
}

pub fn generate_totp_at(secret_b32: &str, unix_secs: u64) -> Result<TotpCode> {
    let totp = build_totp(secret_b32)?;
    let code = totp
        .generate(unix_secs)
        ;
    let elapsed = unix_secs % TOTP_PERIOD;
    let seconds_remaining = TOTP_PERIOD - elapsed;
    Ok(TotpCode {
        code,
        seconds_remaining,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // RFC 6238 Appendix B — SHA1, secret "12345678901234567890" as ASCII (not Base32).
    // totp-rs expects Base32; use a well-known Base32 seed instead.
    // Secret "JBSWY3DPEHPK3PXP" is common demo ("Hello!").
    #[test]
    fn normalize_raw_base32() {
        let s = normalize_otp_secret("jbswy3dpehpk3pxp").unwrap();
        assert_eq!(s, "JBSWY3DPEHPK3PXP");
    }

    #[test]
    fn parse_otpauth() {
        let uri = "otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";
        let s = parse_otpauth_uri(uri).unwrap();
        assert_eq!(s, "JBSWY3DPEHPK3PXP");
    }

    #[test]
    fn generate_is_six_digits() {
        let code = generate_totp_at("JBSWY3DPEHPK3PXP", 1_234_567_890).unwrap();
        assert_eq!(code.code.len(), 6);
        assert!(code.code.chars().all(|c| c.is_ascii_digit()));
        assert!(code.seconds_remaining > 0 && code.seconds_remaining <= 30);
    }

    #[test]
    fn invalid_secret_fails() {
        assert!(generate_totp_at("!!!", 0).is_err());
    }

    #[test]
    fn empty_normalizes() {
        assert_eq!(normalize_otp_secret("  ").unwrap(), "");
    }
}
