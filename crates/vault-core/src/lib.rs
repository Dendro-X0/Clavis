//! Encrypted local-first credential vault.

mod crypto;
mod error;
mod format;
mod import_export;
mod model;
mod store;

pub use error::{Result, VaultError};
pub use format::{
    VaultCryptoInfo, peek_kdf_from_bytes, peek_kdf_from_path, write_all_atomic,
};
pub use import_export::{
    export_encrypted, import_credential_text, import_credentials_auto,
    import_credentials_from_path, import_csv_logins, import_encrypted, merge_entries,
};
pub use model::{CustomField, Entry, EntryType, VaultDocument, VaultMeta, Workspace};
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
    fn text_import_parses_mixed_account_dump() {
        let text = r#"Username: Test
Email: paf437sywst688@gmail.com
Password: Tuep47s#s@!

Test1
Email: paf437sywst688+test1@gmail.com
Password: ds_ut$7wDx#

John Doe
Email: john@example.com
Password: S7#s3%8ase

Test User 1
Email: Test1@example.com
Password: B2$s3_5ase

A:

Username: Tester1

Password: SyI14^ew1E

Public key: npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg

Private Key: c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884

Friend Code: OBSCUR-5KMPFN

B:

Username: Tester2

Password: HT512#scE8

Public key: npub18kc9tdr7qk7lhyyralkqk7hv62sytklhmpju7nv4mxyp0k2xsv8ss7n67a

Private Key: nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta

Friend Code: OBSCUR-GBKMBC

Demouser:

Username: DemoUser

Password: 7654seADS@Xq

Public key: 87cb2c2063308d194111eea99643697dfa526af07516f09d4722258e94830125

Private Key: 095648f20fc8f90d4a0e8c0f7737fd6e18a5d57e1af2c8100caa6954484c367d

Friend Code: OBSCUR-TJATYL

pnpm cache:clear && pnpm dev:desktop
"#;
        let entries = import_credential_text(text).unwrap();
        assert!(
            entries.len() >= 7,
            "expected several accounts, got {}: {:?}",
            entries.len(),
            entries.iter().map(|e| e.title.as_str()).collect::<Vec<_>>()
        );
        assert!(entries.iter().all(|e| e.title != "Imported login"));
        assert!(entries.iter().all(|e| !e.password.is_empty()));
        assert!(entries.iter().all(|e| !e.username.is_empty() || !e.title.is_empty()));

        let test = entries.iter().find(|e| e.title == "Test").unwrap();
        assert_eq!(test.username, "paf437sywst688@gmail.com");
        assert_eq!(test.password, "Tuep47s#s@!");

        let a = entries.iter().find(|e| e.title == "A").unwrap();
        assert_eq!(a.username, "Tester1");
        assert_eq!(a.password, "SyI14^ew1E");
        assert!(a.notes.contains("Public key"));
        assert!(a.notes.contains("Friend Code"));

        let demo = entries.iter().find(|e| e.title == "Demouser").unwrap();
        assert_eq!(demo.username, "DemoUser");
        assert_eq!(demo.password, "7654seADS@Xq");

        assert!(!entries.iter().any(|e| e.title.contains("pnpm")));
    }

    #[test]
    fn text_import_parses_account_blocks_simple() {
        let text = "Username: Test\nEmail: paf437sywst688@gmail.com\nPassword: Tuep47s#s@!\n\nTest1\nEmail: paf437sywst688+test1@gmail.com\nPassword: ds_ut$7WDx#\n\nJohn Doe\nEmail: john@example.com\nPassword: S7#s3%8ase\n";
        let entries = import_credential_text(text).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].title, "Test");
        assert_eq!(entries[0].username, "paf437sywst688@gmail.com");
        assert_eq!(entries[0].password, "Tuep47s#s@!");
        assert_eq!(entries[1].title, "Test1");
        assert_eq!(entries[1].username, "paf437sywst688+test1@gmail.com");
        assert_eq!(entries[2].title, "John Doe");
        assert_eq!(entries[2].username, "john@example.com");
    }

    #[test]
    fn text_import_partial_fields_and_name_label() {
        // Missing URL / categories is fine; Name: is display title, not username.
        let text = "\
Name: Test
Username: tester
Password: secret1

Name: OnlyEmail
Email: only@ex.com
Password: secret2
";
        let entries = import_credential_text(text).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].title, "Test");
        assert_eq!(entries[0].username, "tester");
        assert!(entries[0].url.is_empty());
        assert_eq!(entries[1].title, "OnlyEmail");
        assert_eq!(entries[1].username, "only@ex.com");
    }

    #[test]
    fn text_import_skips_incomplete_without_password() {
        let text = "\
Name: Incomplete
Username: no-pass-yet

Name: Complete
Username: ok
Password: has-pass
";
        let entries = import_credential_text(text).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Complete");
    }

    #[test]
    fn text_import_categories_from_copy_format() {
        let text = "Name: Work\nUsername: a@b.com\nPassword: x\nCategories: work, banking\n";
        let entries = import_credential_text(text).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].tags, vec!["work".to_string(), "banking".to_string()]);
    }

    #[test]
    fn text_import_real_test_account_fixture() {
        let text = include_str!("../tests/fixtures/test-account.txt");
        let entries = import_credential_text(text).unwrap();
        // Email-style accounts (11) + A/B/Demouser (3) = 14
        assert_eq!(
            entries.len(),
            14,
            "titles: {:?}",
            entries.iter().map(|e| e.title.as_str()).collect::<Vec<_>>()
        );
        assert!(entries.iter().all(|e| e.title != "Imported login"));
        assert!(entries.iter().all(|e| !e.password.is_empty()));
    }

    #[test]
    fn csv_import_email_column() {
        let csv = "name,email,password\nAdmin,admin@ex.com,secret\n";
        let entries = import_csv_logins(csv).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Admin");
        assert_eq!(entries[0].username, "admin@ex.com");
        assert_eq!(entries[0].password, "secret");
    }

    #[test]
    fn plaintext_not_in_file() {
        let mut d = VaultDocument::new("secret-vault");
        let mut entry = Entry::new(EntryType::Login, "Bank");
        entry.password = "super-secret-password-xyz".into();
        d.active_workspace_mut().unwrap().entries.push(entry);
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
        assert_eq!(restored.list_entries().unwrap()[0].password, "tok-123");
    }

    #[test]
    fn workspaces_import_and_replace() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let params = fast_params();
        let encoded = encode_vault(&VaultDocument::new("demo"), "pw", &params).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let mut session = open_vault_file(&path, "pw").unwrap();
        assert_eq!(session.list_workspaces().len(), 1);

        let mut a = Entry::new(EntryType::Login, "A");
        a.password = "1".into();
        a.username = "a@x.com".into();
        let ws = session
            .import_as_workspace("Test Account", Some("Test Account.txt".into()), vec![a])
            .unwrap();
        assert_eq!(session.list_workspaces().len(), 2);
        assert_eq!(session.active_workspace_id(), ws.id);
        assert_eq!(session.list_entries().unwrap().len(), 1);

        let mut b = Entry::new(EntryType::Login, "B");
        b.password = "2".into();
        b.username = "b@x.com".into();
        let mut c = Entry::new(EntryType::Login, "C");
        c.password = "3".into();
        c.username = "c@x.com".into();
        session
            .replace_workspace_entries(&ws.id, vec![b, c], Some("Test Account.txt".into()))
            .unwrap();
        assert_eq!(session.list_entries().unwrap().len(), 2);
        assert_eq!(session.list_entries().unwrap()[0].title, "B");

        assert_eq!(
            session.find_workspace_id_by_name("test account").as_deref(),
            Some(ws.id.as_str())
        );
    }

    #[test]
    fn list_all_entries_spans_workspaces() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let params = fast_params();
        let encoded = encode_vault(&VaultDocument::new("demo"), "pw", &params).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let mut session = open_vault_file(&path, "pw").unwrap();

        let mut a = Entry::new(EntryType::Login, "Alpha");
        a.password = "1".into();
        session
            .import_as_workspace("WS-A", None, vec![a])
            .unwrap();
        let mut b = Entry::new(EntryType::Login, "Beta");
        b.password = "2".into();
        session
            .import_as_workspace("WS-B", None, vec![b])
            .unwrap();

        let all = session.list_all_entries();
        let titles: Vec<&str> = all.iter().map(|(_, _, e)| e.title.as_str()).collect();
        assert!(titles.contains(&"Alpha"));
        assert!(titles.contains(&"Beta"));
        let alpha = all.iter().find(|(_, _, e)| e.title == "Alpha").unwrap();
        assert_eq!(alpha.1, "WS-A");
        let beta = all.iter().find(|(_, _, e)| e.title == "Beta").unwrap();
        assert_eq!(beta.1, "WS-B");
    }

    #[test]
    fn merge_duplicate_workspaces_keeps_entries() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let params = fast_params();
        let encoded = encode_vault(&VaultDocument::new("demo"), "pw", &params).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let mut session = open_vault_file(&path, "pw").unwrap();

        let mut a = Entry::new(EntryType::Login, "A");
        a.password = "1".into();
        let mut b = Entry::new(EntryType::Login, "B");
        b.password = "2".into();
        session
            .import_as_workspace("Dup", None, vec![a])
            .unwrap();
        session
            .import_as_workspace("dup", None, vec![b])
            .unwrap();
        assert_eq!(session.list_workspaces().len(), 3); // Personal + 2 dups
        let removed = session.merge_duplicate_workspaces().unwrap();
        assert_eq!(removed, 1);
        assert_eq!(session.list_workspaces().len(), 2);
        let dup = session
            .list_workspaces()
            .iter()
            .find(|w| w.name.eq_ignore_ascii_case("dup"))
            .unwrap();
        assert_eq!(dup.entries.len(), 2);
    }

    #[test]
    fn legacy_flat_entries_migrate() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("legacy.km");
        let params = fast_params();
        let mut doc = VaultDocument::new("legacy");
        doc.workspaces.clear();
        doc.active_workspace_id.clear();
        let mut e = Entry::new(EntryType::Login, "Old");
        e.password = "x".into();
        e.username = "u".into();
        doc.entries.push(e);
        let encoded = encode_vault(&doc, "pw", &params).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let session = open_vault_file(&path, "pw").unwrap();
        assert_eq!(session.list_workspaces().len(), 1);
        assert_eq!(session.list_entries().unwrap().len(), 1);
        assert_eq!(session.list_entries().unwrap()[0].title, "Old");
    }

    #[test]
    fn scrub_secrets_clears_sensitive_fields() {
        let mut entry = Entry::new(EntryType::Login, "Bank");
        entry.password = "hunter2".into();
        entry.notes = "ssn-900".into();
        entry.custom_fields.push(crate::model::CustomField {
            label: "pin".into(),
            value: "1234".into(),
        });
        entry.scrub_secrets();
        assert!(entry.password.is_empty());
        assert!(entry.notes.is_empty());
        assert!(entry.custom_fields.iter().all(|f| f.value.is_empty()));
        assert_eq!(entry.title, "Bank");
    }

    #[test]
    fn lock_drops_session_and_vault_remains_readable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("lock.km");
        let mut session = create_vault(&path, "LockTest", "master-pw").unwrap();
        let mut e = Entry::new(EntryType::Login, "Site");
        e.password = "secret-pass".into();
        session.upsert_entry(e).unwrap();
        assert_eq!(session.list_entries().unwrap().len(), 1);
        session.into_locked();
        let again = open_vault_file(&path, "master-pw").unwrap();
        assert_eq!(again.list_entries().unwrap()[0].password, "secret-pass");
    }

    #[test]
    fn atomic_write_replaces_and_leaves_no_tmp() {
        use crate::format::{atomic_temp_path, write_all_atomic};
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        write_all_atomic(&path, b"first").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"first");
        write_all_atomic(&path, b"second-longer").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"second-longer");
        assert!(!atomic_temp_path(&path).exists());
    }

    #[test]
    fn orphan_tmp_does_not_corrupt_open() {
        use crate::format::atomic_temp_path;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let mut session = create_vault(&path, "Tmp", "pw").unwrap();
        let mut e = Entry::new(EntryType::Login, "Keep");
        e.password = "ok".into();
        session.upsert_entry(e).unwrap();
        session.into_locked();

        let tmp = atomic_temp_path(&path);
        std::fs::write(&tmp, b"not-a-vault").unwrap();
        assert!(tmp.is_file());

        let again = open_vault_file(&path, "pw").unwrap();
        assert_eq!(again.list_entries().unwrap()[0].title, "Keep");
        assert!(!tmp.exists(), "orphan tmp should be cleaned on open");
    }

    #[test]
    fn crash_mid_write_leaves_prior_vault_intact() {
        use crate::format::atomic_temp_path;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        crate::format::write_all_atomic(&path, b"good-vault-bytes").unwrap();
        let before = std::fs::read(&path).unwrap();

        // Simulate crash after writing temp, before replace.
        let tmp = atomic_temp_path(&path);
        std::fs::write(&tmp, b"partial-or-corrupt").unwrap();
        assert!(tmp.is_file());
        assert_eq!(std::fs::read(&path).unwrap(), before);

        // App restart cleanup + open path for real vaults uses cleanup_orphan_temps.
        crate::format::cleanup_orphan_temps(&path);
        assert!(!tmp.exists());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn bak_recovered_when_primary_missing() {
        use crate::format::{atomic_backup_path, write_all_atomic};
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let encoded = encode_vault(&VaultDocument::new("bak"), "pw", &fast_params()).unwrap();
        write_all_atomic(&path, &encoded).unwrap();
        let bak = atomic_backup_path(&path);
        std::fs::rename(&path, &bak).unwrap();
        assert!(!path.exists());
        let session = open_vault_file(&path, "pw").unwrap();
        assert_eq!(session.document().meta.name, "bak");
        assert!(path.is_file());
        assert!(!bak.exists());
    }

    #[test]
    fn peek_kdf_reads_header_without_password() {
        use crate::format::{peek_kdf_from_bytes, write_all_atomic};
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let weak = KdfParams {
            m_cost: 8,
            t_cost: 1,
            p_cost: 1,
        };
        let bytes = encode_vault(&VaultDocument::new("peek"), "pw", &weak).unwrap();
        write_all_atomic(&path, &bytes).unwrap();
        let info = peek_kdf_from_bytes(&bytes).unwrap();
        assert_eq!(info.algorithm, "argon2id");
        assert_eq!(info.aead, "aes-256-gcm");
        assert_eq!(info.m_cost, 8);
        assert!(info.is_weaker_than_defaults());
        let from_path = crate::format::peek_kdf_from_path(&path).unwrap();
        assert_eq!(from_path, info);
    }

    #[test]
    fn upgrade_kdf_to_defaults_strengthens_header() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vault.km");
        let weak = KdfParams {
            m_cost: 8,
            t_cost: 1,
            p_cost: 1,
        };
        let encoded = encode_vault(&VaultDocument::new("up"), "secret", &weak).unwrap();
        crate::format::write_all_atomic(&path, &encoded).unwrap();
        let mut session = open_vault_file(&path, "secret").unwrap();
        assert!(session.crypto_info().is_weaker_than_defaults());
        let info = session.upgrade_kdf_to_defaults("secret").unwrap();
        assert!(!info.is_weaker_than_defaults());
        session.into_locked();
        let again = open_vault_file(&path, "secret").unwrap();
        assert!(!again.crypto_info().is_weaker_than_defaults());
    }
}
