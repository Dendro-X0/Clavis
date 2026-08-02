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

fn looks_like_email(s: &str) -> bool {
    let s = s.trim();
    s.contains('@') && s.contains('.') && !s.contains(' ')
}

fn labeled_value<'a>(line: &'a str, keys: &[&str]) -> Option<&'a str> {
    let trimmed = line.trim();
    let Some((raw_key, rest)) = trimmed.split_once(':') else {
        return None;
    };
    let key = raw_key.trim();
    if keys.iter().any(|k| key.eq_ignore_ascii_case(k)) {
        let v = rest.trim();
        if !v.is_empty() {
            return Some(v);
        }
    }
    None
}

/// `A:` / `Demouser:` — section label with nothing after the colon.
fn section_header(line: &str) -> Option<&str> {
    let trimmed = line.trim();
    let Some((raw_key, rest)) = trimmed.split_once(':') else {
        return None;
    };
    if !rest.trim().is_empty() {
        return None;
    }
    let key = raw_key.trim();
    if key.is_empty() || key.len() > 48 {
        return None;
    }
    // Avoid treating real field names as section headers.
    const FIELD_NAMES: &[&str] = &[
        "Username",
        "User name",
        "User",
        "Account",
        "Name",
        "Login",
        "Email",
        "E-mail",
        "Mail",
        "Password",
        "Pass",
        "Pwd",
        "Secret",
        "URL",
        "Website",
        "Site",
        "Link",
        "Notes",
        "Note",
        "Comment",
        "Public key",
        "Private Key",
        "Private key",
        "Friend Code",
        "Friend code",
    ];
    if FIELD_NAMES.iter().any(|k| key.eq_ignore_ascii_case(k)) {
        return None;
    }
    Some(key)
}

fn is_junk_line(line: &str) -> bool {
    let t = line.trim();
    if t.is_empty() {
        return true;
    }
    let lower = t.to_ascii_lowercase();
    lower.contains("&&")
        || lower.starts_with("pnpm ")
        || lower.starts_with("npm ")
        || lower.starts_with("cargo ")
        || lower.starts_with("yarn ")
}

fn is_credential_field_line(line: &str) -> bool {
    labeled_value(
        line,
        &[
            "Username",
            "User name",
            "User",
            "Account",
            "Name",
            "Login",
            "Email",
            "E-mail",
            "Mail",
            "Password",
            "Pass",
            "Pwd",
            "Secret",
            "URL",
            "Website",
            "Site",
            "Link",
            "Notes",
            "Note",
            "Comment",
            "Public key",
            "Private Key",
            "Private key",
            "Friend Code",
            "Friend code",
            "Npub",
            "Nsec",
        ],
    )
    .is_some()
        || looks_like_email(line)
}

#[derive(Default)]
struct Draft {
    title: String,
    username: String,
    email: String,
    password: String,
    url: String,
    tags: Vec<String>,
    extras: Vec<String>,
}

impl Draft {
    fn is_empty(&self) -> bool {
        self.title.is_empty()
            && self.username.is_empty()
            && self.email.is_empty()
            && self.password.is_empty()
            && self.extras.is_empty()
            && self.url.is_empty()
            && self.tags.is_empty()
    }

    fn has_password(&self) -> bool {
        !self.password.is_empty()
    }

    /// Ready to seal: must have a password plus some identity.
    /// Optional fields (URL, notes, categories) may be missing.
    fn is_complete(&self) -> bool {
        self.has_password()
            && (!self.email.is_empty() || !self.username.is_empty() || !self.title.is_empty())
    }

    fn apply_line(&mut self, line: &str) {
        let line = line.trim();
        if line.is_empty() || is_junk_line(line) {
            return;
        }

        // Display name (from Clavis "Copy" / exports) — not the login username.
        if let Some(v) = labeled_value(line, &["Name", "Title", "Display name"]) {
            self.title = v.to_string();
            return;
        }
        if let Some(v) = labeled_value(
            line,
            &["Username", "User name", "User", "Account", "Login"],
        ) {
            if self.username.is_empty() {
                self.username = v.to_string();
            } else {
                self.extras.push(format!("Username: {v}"));
            }
            if self.title.is_empty() {
                self.title = v.to_string();
            }
            return;
        }
        if let Some(v) = labeled_value(line, &["Email", "E-mail", "Mail"]) {
            self.email = v.to_string();
            return;
        }
        if let Some(v) = labeled_value(line, &["Password", "Pass", "Pwd"]) {
            self.password = v.to_string();
            return;
        }
        if let Some(v) = labeled_value(line, &["URL", "Website", "Site", "Link"]) {
            self.url = v.to_string();
            return;
        }
        if let Some(v) = labeled_value(line, &["Categories", "Category", "Tags", "Tag"]) {
            for part in v.split(',') {
                let t = part.trim();
                if !t.is_empty() && !self.tags.iter().any(|x| x.eq_ignore_ascii_case(t)) {
                    self.tags.push(t.to_string());
                }
            }
            return;
        }
        if let Some(v) = labeled_value(
            line,
            &[
                "Notes",
                "Note",
                "Comment",
                "Public key",
                "Private Key",
                "Private key",
                "Friend Code",
                "Friend code",
                "Npub",
                "Nsec",
                "Secret",
            ],
        ) {
            let key = line.split_once(':').map(|(k, _)| k.trim()).unwrap_or("Note");
            // "Notes:" with empty value starts a notes section — later unlabeled lines append.
            if !v.is_empty() {
                self.extras.push(format!("{key}: {v}"));
            }
            return;
        }
        if looks_like_email(line) && self.email.is_empty() {
            self.email = line.to_string();
            return;
        }
        // Bare account label (e.g. "Test User 1" / "John Doe")
        if !line.contains(':') && self.title.is_empty() && self.username.is_empty() {
            self.title = line.to_string();
            return;
        }
        self.extras.push(line.to_string());
    }

    fn into_entry(self) -> Option<Entry> {
        if !self.is_complete() {
            return None;
        }
        entry_from_fields(
            self.title,
            self.username,
            self.email,
            self.password,
            self.url,
            self.extras.join("\n"),
            self.tags,
        )
    }
}

fn entry_from_fields(
    title: String,
    username: String,
    email: String,
    password: String,
    url: String,
    extra_notes: String,
    tags: Vec<String>,
) -> Option<Entry> {
    if password.is_empty() {
        return None;
    }
    if title.is_empty() && username.is_empty() && email.is_empty() {
        return None;
    }

    let display = if !title.is_empty() {
        title.clone()
    } else if !username.is_empty() {
        username.clone()
    } else {
        email.clone()
    };

    let login_user = if !email.is_empty() {
        email.clone()
    } else {
        username.clone()
    };

    let mut notes = String::new();
    if !email.is_empty() && !username.is_empty() && email != username {
        notes.push_str(&format!("Account name: {username}"));
    }
    if !extra_notes.is_empty() {
        if !notes.is_empty() {
            notes.push('\n');
        }
        notes.push_str(&extra_notes);
    }

    let mut entry = Entry::new(EntryType::Login, display);
    entry.username = login_user;
    entry.password = password;
    entry.url = url;
    entry.notes = notes;
    entry.tags = tags;
    entry.updated_at = Utc::now();
    Some(entry)
}

fn starts_new_record(line: &str, current: &Draft) -> bool {
    if current.is_empty() {
        return false;
    }
    // Only split once the current draft already has a password (complete-ish).
    if !current.has_password() {
        return false;
    }
    if section_header(line).is_some() {
        return true;
    }
    // New bare title after a finished login.
    if !line.contains(':') && !looks_like_email(line) && !is_junk_line(line) {
        return true;
    }
    // New Username:/Email: block after a finished login.
    if labeled_value(
        line,
        &[
            "Username",
            "User name",
            "User",
            "Account",
            "Name",
            "Title",
            "Login",
            "Email",
            "E-mail",
            "Mail",
        ],
    )
    .is_some()
    {
        return true;
    }
    false
}

/// Parse freeform credential notes.
///
/// Blank lines inside an account are ignored. A new account starts when a
/// section header (`A:`), bare title, or Username/Email label appears after a
/// record that already has a password.
pub fn import_credential_text(text: &str) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    let mut current = Draft::default();

    let flush = |draft: &mut Draft, entries: &mut Vec<Entry>| {
        if let Some(entry) = std::mem::take(draft).into_entry() {
            entries.push(entry);
        } else {
            *draft = Draft::default();
        }
    };

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || is_junk_line(line) {
            continue;
        }

        if let Some(header) = section_header(line) {
            flush(&mut current, &mut entries);
            current.title = header.to_string();
            continue;
        }

        if starts_new_record(line, &current) {
            flush(&mut current, &mut entries);
        }

        // If we somehow still have a complete draft and see another credential
        // starter, prefer splitting (covers edge cases without blank lines).
        if current.is_complete()
            && (section_header(line).is_some()
                || (!line.contains(':') && !is_credential_field_line(line)))
        {
            flush(&mut current, &mut entries);
        }

        current.apply_line(line);
    }
    flush(&mut current, &mut entries);

    if entries.is_empty() {
        return Err(VaultError::Message(
            "no login credentials found in text".into(),
        ));
    }
    Ok(entries)
}

fn header_index(headers: &csv::StringRecord, names: &[&str]) -> Option<usize> {
    headers.iter().position(|h| {
        names
            .iter()
            .any(|n| h.trim().eq_ignore_ascii_case(n))
    })
}

/// Parse CSV/TSV logins with flexible headers (title, username, email, password, …).
pub fn import_csv_logins(csv_data: &str) -> Result<Vec<Entry>> {
    let delimiter = if csv_data.lines().next().map(|l| l.matches('\t').count()).unwrap_or(0) >= 2 {
        b'\t'
    } else {
        b','
    };

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(csv_data));

    let headers = reader
        .headers()
        .map_err(|e| VaultError::Csv(e.to_string()))?
        .clone();

    let title_i = header_index(&headers, &["title", "name", "account", "label"]);
    let user_i = header_index(&headers, &["username", "user", "login", "account name"]);
    let email_i = header_index(&headers, &["email", "e-mail", "mail"]);
    let pass_i = header_index(&headers, &["password", "pass", "pwd", "secret"]);
    let url_i = header_index(&headers, &["url", "website", "site", "link"]);
    let notes_i = header_index(&headers, &["notes", "note", "comment"]);

    // Headerless fallback: assume username/email, password [, title]
    let headerless = title_i.is_none()
        && user_i.is_none()
        && email_i.is_none()
        && pass_i.is_none()
        && headers.iter().all(|h| {
            let t = h.trim();
            t.is_empty() || looks_like_email(t) || t.len() < 3
        });

    let mut entries = Vec::new();

    if headerless {
        // Treat first row as data too — re-parse without headers
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .has_headers(false)
            .flexible(true)
            .trim(csv::Trim::All)
            .from_reader(Cursor::new(csv_data));
        for record in reader.records() {
            let record = record.map_err(|e| VaultError::Csv(e.to_string()))?;
            let cols: Vec<&str> = record.iter().collect();
            if cols.is_empty() {
                continue;
            }
            let (title, username, email, password) = match cols.len() {
                1 => (cols[0].to_string(), String::new(), String::new(), String::new()),
                2 if looks_like_email(cols[0]) => {
                    (String::new(), String::new(), cols[0].to_string(), cols[1].to_string())
                }
                2 => (cols[0].to_string(), cols[0].to_string(), String::new(), cols[1].to_string()),
                _ => {
                    let a = cols[0];
                    let b = cols[1];
                    let c = cols.get(2).copied().unwrap_or("");
                    if looks_like_email(b) {
                        (a.to_string(), String::new(), b.to_string(), c.to_string())
                    } else if looks_like_email(a) {
                        (String::new(), String::new(), a.to_string(), b.to_string())
                    } else {
                        (a.to_string(), b.to_string(), String::new(), c.to_string())
                    }
                }
            };
            if let Some(e) = entry_from_fields(
                title,
                username,
                email,
                password,
                String::new(),
                String::new(),
                Vec::new(),
            ) {
                entries.push(e);
            }
        }
    } else {
        for record in reader.records() {
            let record = record.map_err(|e| VaultError::Csv(e.to_string()))?;
            let get = |i: Option<usize>| {
                i.and_then(|i| record.get(i)).unwrap_or("").to_string()
            };
            let title = get(title_i);
            let username = get(user_i);
            let email = get(email_i);
            let password = get(pass_i);
            let url = get(url_i);
            let notes = get(notes_i);
            if let Some(e) =
                entry_from_fields(title, username, email, password, url, notes, Vec::new())
            {
                entries.push(e);
            }
        }
    }

    if entries.is_empty() {
        return Err(VaultError::Message(
            "no login credentials found in spreadsheet".into(),
        ));
    }
    Ok(entries)
}

/// Auto-detect freeform text vs CSV/TSV and parse credentials.
pub fn import_credentials_auto(text: &str) -> Result<Vec<Entry>> {
    let sample: String = text.lines().take(12).collect::<Vec<_>>().join("\n");
    let has_labels = sample.lines().any(|l| {
        labeled_value(
            l,
            &["Email", "Password", "Username", "User", "Pass", "E-mail"],
        )
        .is_some()
    });
    let first = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
    let lower_first = first.to_lowercase();
    let comma_cols = first.split(',').count();
    let tab_cols = first.split('\t').count();
    let looks_tabular = !has_labels
        && ((comma_cols >= 2 || tab_cols >= 2)
            && (lower_first.contains("password")
                || lower_first.contains("email")
                || lower_first.contains("username")
                || lower_first.contains("user"))
            || (comma_cols >= 3 || tab_cols >= 3));

    if has_labels {
        import_credential_text(text)
    } else if looks_tabular {
        import_csv_logins(text).or_else(|_| import_credential_text(text))
    } else {
        import_credential_text(text).or_else(|_| import_csv_logins(text))
    }
}

/// Import from a file path: `.txt` / `.md` as text; `.csv` / `.tsv` as table;
/// `.xlsx` / `.xls` / `.ods` via first sheet.
pub fn import_credentials_from_path(path: &Path) -> Result<Vec<Entry>> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "csv" | "tsv" => {
            let text = std::fs::read_to_string(path)?;
            import_csv_logins(&text)
        }
        "xlsx" | "xls" | "ods" => import_spreadsheet_file(path),
        _ => {
            let text = std::fs::read_to_string(path)?;
            import_credentials_auto(&text)
        }
    }
}

fn import_spreadsheet_file(path: &Path) -> Result<Vec<Entry>> {
    let mut workbook = calamine::open_workbook_auto(path)
        .map_err(|e| VaultError::Message(format!("spreadsheet open failed: {e}")))?;
    use calamine::Reader;
    let sheet_names = workbook.sheet_names().to_vec();
    let sheet = sheet_names
        .first()
        .ok_or_else(|| VaultError::Message("spreadsheet has no sheets".into()))?;
    let range = workbook
        .worksheet_range(sheet)
        .map_err(|e| VaultError::Message(format!("sheet read failed: {e}")))?;

    let mut lines: Vec<String> = Vec::new();
    for row in range.rows() {
        let cells: Vec<String> = row
            .iter()
            .map(|c| match c {
                calamine::Data::Empty => String::new(),
                other => other.to_string(),
            })
            .collect();
        if cells.iter().all(|c| c.trim().is_empty()) {
            continue;
        }
        // Escape commas for CSV round-trip
        let line = cells
            .iter()
            .map(|c| {
                if c.contains(',') || c.contains('"') || c.contains('\n') {
                    format!("\"{}\"", c.replace('"', "\"\""))
                } else {
                    c.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(",");
        lines.push(line);
    }
    if lines.is_empty() {
        return Err(VaultError::Message("spreadsheet is empty".into()));
    }
    import_csv_logins(&lines.join("\n"))
}

pub fn merge_entries(doc: &mut VaultDocument, entries: Vec<Entry>) {
    doc.normalize();
    if let Some(ws) = doc.active_workspace_mut() {
        for entry in entries {
            ws.entries.push(entry);
        }
        ws.updated_at = Utc::now();
    }
    doc.meta.updated_at = Utc::now();
}
