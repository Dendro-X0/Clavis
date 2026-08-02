//! Encrypted local-first credential vault.

mod crypto;
mod error;
mod format;
mod import_export;
mod model;
mod store;

pub use error::{Result, VaultError};
pub use import_export::{export_encrypted, import_csv_logins, import_encrypted, merge_entries};
pub use model::{CustomField, Entry, EntryType, VaultDocument, VaultMeta};
pub use store::{VaultSession, VaultStatus, create_vault, open_vault_file, vault_exists};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::KdfParams;
    use crate::format::{decode_vault, encode_vault};
    use crate::model::{Entry, EntryType, VaultDocument};

    fn fast_params() -> KdfParams {
        KdfParams {
            m_cost: 8,
            t_cost: 1,
            p_cost: 1,
        }
    }

    #[test]
    fn round_trip_encrypt_decrypt() {
        let doc = VaultDocument::new("test");
        let bytes = encode_vault(&doc, "correct horse", &fast_params()).unwrap();
        let (opened, _, _, _) = decode_vault(&bytes, "correct horse").unwrap();
        assert_eq!(opened.meta.name, "test");
        assert!(opened.entries.is_empty());
    }

    #[test]
    fn wrong_password_fails() {
        let doc = VaultDocument::new("test");
        let bytes = encode_vault(&doc, "correct", &fast_params()).unwrap();
        match decode_vault(&bytes, "wrong") {
            Err(VaultError::WrongPassword) => {}
            Ok(_) => panic!("expected wrong password"),
            Err(e) => panic!("unexpected error: {e}"),
        }
    }

    #[test]
    fn crud_persists() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let params = fast_params();
        let encoded = encode_vault(&VaultDocument::new("demo"), "pw", &params).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let mut session = open_vault_file(&path, "pw").unwrap();

        let mut entry = Entry::new(EntryType::Login, "GitHub");
        entry.username = "alice".into();
        entry.password = "s3cret".into();
        let saved = session.upsert_entry(entry).unwrap();

        drop(session);
        let session = open_vault_file(&path, "pw").unwrap();
        let got = session.get_entry(&saved.id).unwrap();
        assert_eq!(got.username, "alice");
        assert_eq!(got.password, "s3cret");
    }

    #[test]
    fn csv_import_parses() {
        let csv = "title,username,password,url,notes\nMail,bob,pass,https://mail.test,hi\n";
        let entries = import_csv_logins(csv).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Mail");
        assert_eq!(entries[0].username, "bob");
        assert_eq!(entries[0].password, "pass");
    }

    #[test]
    fn plaintext_not_in_file() {
        let mut d = VaultDocument::new("secret-vault");
        let mut entry = Entry::new(EntryType::Login, "Bank");
        entry.password = "super-secret-password-xyz".into();
        d.entries.push(entry);
        let bytes = encode_vault(&d, "master", &fast_params()).unwrap();
        let hay = String::from_utf8_lossy(&bytes);
        assert!(!hay.contains("super-secret-password-xyz"));
        assert!(!hay.contains("Bank"));
    }

    #[test]
    fn export_import_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("vault.km");
        let backup = dir.path().join("backup.km");
        let params = fast_params();
        let encoded = encode_vault(&VaultDocument::new("demo"), "pw", &params).unwrap();
        crate::format::write_all_atomic(&vault, &encoded).unwrap();

        let mut session = open_vault_file(&vault, "pw").unwrap();
        let mut entry = Entry::new(EntryType::Api, "Token");
        entry.password = "tok-123".into();
        session.upsert_entry(entry).unwrap();
        export_encrypted(&session, &backup).unwrap();
        drop(session);

        std::fs::remove_file(&vault).unwrap();
        let bytes = std::fs::read(&backup).unwrap();
        let restored = import_encrypted(&vault, &bytes, "pw").unwrap();
        assert_eq!(restored.entry_count(), 1);
        assert_eq!(restored.list_entries()[0].password, "tok-123");
    }
}
