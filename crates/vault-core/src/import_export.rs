use std::io::Cursor;
use std::path::Path;

use chrono::Utc;

use crate::error::{Result, VaultError};
use crate::format::{decode_vault, read_all, write_all_atomic};
use crate::model::{Entry, EntryType, VaultDocument};
use crate::store::VaultSession;

/// Copy encrypted vault bytes to a backup path (same format).
pub fn export_encrypted(session: &VaultSession, dest: &Path) -> Result<()> {
    let bytes = read_all(session.path())?;
    write_all_atomic(dest, &bytes)
}

/// Replace the active vault file with an encrypted backup, then re-open with password.
pub fn import_encrypted(
    vault_path: &Path,
    backup_bytes: &[u8],
    password: &str,
) -> Result<VaultSession> {
    let (document, key, salt, params) = decode_vault(backup_bytes, password)?;
    write_all_atomic(vault_path, backup_bytes)?;
    Ok(VaultSession::from_parts(
        vault_path.to_path_buf(),
        document,
        key,
        salt,
        params,
    ))
}

/// Parse a simple CSV of logins: title,username,password,url,notes
pub fn import_csv_logins(csv_data: &str) -> Result<Vec<Entry>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(csv_data));

    let headers = reader
        .headers()
        .map_err(|e| VaultError::Csv(e.to_string()))?
        .clone();

    let idx = |name: &str| {
        headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };

    let title_i = idx("title").or_else(|| idx("name"));
    let user_i = idx("username").or_else(|| idx("user")).or_else(|| idx("login"));
    let pass_i = idx("password").or_else(|| idx("pass"));
    let url_i = idx("url").or_else(|| idx("website"));
    let notes_i = idx("notes").or_else(|| idx("note"));

    let mut entries = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| VaultError::Csv(e.to_string()))?;
        let get = |i: Option<usize>| {
            i.and_then(|i| record.get(i))
                .unwrap_or("")
                .to_string()
        };
        let title = get(title_i);
        if title.is_empty() && get(user_i).is_empty() {
            continue;
        }
        let mut entry = Entry::new(
            EntryType::Login,
            if title.is_empty() {
                get(user_i).clone()
            } else {
                title
            },
        );
        entry.username = get(user_i);
        entry.password = get(pass_i);
        entry.url = get(url_i);
        entry.notes = get(notes_i);
        entry.updated_at = Utc::now();
        entries.push(entry);
    }
    Ok(entries)
}

pub fn merge_entries(doc: &mut VaultDocument, entries: Vec<Entry>) {
    for entry in entries {
        doc.entries.push(entry);
    }
    doc.meta.updated_at = Utc::now();
}
