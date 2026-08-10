//! Clipboard heuristics for "New from clipboard" drafts (no auto-save).

use serde::{Deserialize, Serialize};

use crate::model::{Entry, EntryType};
use crate::totp::{normalize_otp_secret, parse_otpauth_uri};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct QuickAddDraft {
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub otp_secret: String,
    pub tags: Vec<String>,
    pub entry_type: EntryType,
    /// Human-readable reason used for UI toast when empty.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

impl QuickAddDraft {
    pub fn is_useful(&self) -> bool {
        !self.title.trim().is_empty()
            || !self.username.trim().is_empty()
            || !self.password.trim().is_empty()
            || !self.url.trim().is_empty()
            || !self.otp_secret.trim().is_empty()
            || !self.notes.trim().is_empty()
    }

    /// Materialize a new unsaved entry (caller assigns id via `Entry::new` path).
    pub fn into_entry(self) -> Entry {
        let title = if self.title.trim().is_empty() {
            if !self.url.trim().is_empty() {
                self.url.clone()
            } else if !self.username.trim().is_empty() {
                self.username.clone()
            } else {
                "New entry".into()
            }
        } else {
            self.title
        };
        let mut e = Entry::new(self.entry_type, title);
        e.username = self.username;
        e.password = self.password;
        e.url = self.url;
        e.notes = self.notes;
        e.otp_secret = self.otp_secret;
        e.tags = self.tags;
        e
    }
}

/// Parse clipboard text into a draft. Returns `None` when nothing useful was found.
pub fn parse_clipboard_for_quick_add(text: &str) -> Option<QuickAddDraft> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    // otpauth://…
    if trimmed.to_ascii_lowercase().starts_with("otpauth://") {
        if let Ok(secret) = parse_otpauth_uri(trimmed) {
            let (issuer, account) = parse_otpauth_label(trimmed);
            let title = account
                .clone()
                .or_else(|| issuer.clone())
                .unwrap_or_else(|| "TOTP".into());
            let mut draft = QuickAddDraft {
                title,
                username: account.unwrap_or_default(),
                otp_secret: secret,
                entry_type: EntryType::Login,
                hint: Some("Parsed otpauth URI".into()),
                ..Default::default()
            };
            if let Some(issuer) = issuer {
                if draft.title != issuer && draft.notes.is_empty() {
                    draft.notes = format!("Issuer: {issuer}");
                }
            }
            return Some(draft);
        }
    }

    if let Some(draft) = parse_labeled(trimmed) {
        if draft.is_useful() {
            return Some(draft);
        }
    }

    // Single-line password-like blob
    if !trimmed.contains('\n') && looks_like_password(trimmed) {
        return Some(QuickAddDraft {
            password: trimmed.to_string(),
            entry_type: EntryType::Login,
            hint: Some("Detected password-like text".into()),
            ..Default::default()
        });
    }

    // Two-line user / pass
    let lines: Vec<&str> = trimmed
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    if lines.len() == 2 && looks_like_username(lines[0]) && looks_like_password(lines[1]) {
        return Some(QuickAddDraft {
            username: lines[0].to_string(),
            password: lines[1].to_string(),
            entry_type: EntryType::Login,
            hint: Some("Parsed username / password lines".into()),
            ..Default::default()
        });
    }

    None
}

/// Best-effort label from `otpauth://totp/Issuer:account?...` or `...?issuer=`.
fn parse_otpauth_label(uri: &str) -> (Option<String>, Option<String>) {
    let mut issuer = None;
    let mut account = None;
    if let Some(q) = uri.split('?').nth(1) {
        for part in q.split('&') {
            let mut kv = part.splitn(2, '=');
            if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                if k.eq_ignore_ascii_case("issuer") {
                    issuer = Some(urlencoding_decode(v));
                }
            }
        }
    }
    if let Some(path) = uri.split("://").nth(1).and_then(|r| r.split('?').next()) {
        // totp/Label or hotp/Label
        if let Some(label) = path.split('/').nth(1) {
            let decoded = urlencoding_decode(label);
            if let Some((iss, acc)) = decoded.split_once(':') {
                if issuer.is_none() {
                    issuer = Some(iss.to_string());
                }
                account = Some(acc.to_string());
            } else if !decoded.is_empty() {
                account = Some(decoded);
            }
        }
    }
    (issuer, account)
}

fn urlencoding_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h = |c: u8| -> Option<u8> {
                match c {
                    b'0'..=b'9' => Some(c - b'0'),
                    b'a'..=b'f' => Some(c - b'a' + 10),
                    b'A'..=b'F' => Some(c - b'A' + 10),
                    _ => None,
                }
            };
            if let (Some(a), Some(b)) = (h(bytes[i + 1]), h(bytes[i + 2])) {
                out.push((a << 4) | b);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn match_label(line: &str, labels: &[&str]) -> Option<String> {
    let idx = line.find(':')?;
    if idx == 0 {
        return None;
    }
    let key = line[..idx].trim().to_ascii_lowercase();
    let value = line[idx + 1..].trim().to_string();
    for label in labels {
        if key == label.to_ascii_lowercase() {
            return Some(value);
        }
    }
    None
}

fn parse_labeled(text: &str) -> Option<QuickAddDraft> {
    let mut draft = QuickAddDraft {
        entry_type: EntryType::Login,
        hint: Some("Parsed labeled credentials".into()),
        ..Default::default()
    };
    let mut note_lines: Vec<String> = Vec::new();
    let mut in_notes = false;
    let mut found = false;

    for raw in text.split('\n') {
        let line = raw.trim_end();
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_notes {
                note_lines.push(String::new());
            }
            continue;
        }

        if let Some(v) = match_label(trimmed, &["Name", "Title", "Display name"]) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                draft.title = v;
            }
            continue;
        }
        if let Some(v) = match_label(
            trimmed,
            &["Username", "User name", "User", "Account", "Login"],
        ) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                draft.username = v;
            }
            continue;
        }
        if let Some(v) = match_label(trimmed, &["Email", "E-mail", "Mail"]) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                if draft.username.is_empty() {
                    draft.username = v;
                } else {
                    note_lines.push(format!("Email: {v}"));
                }
            }
            continue;
        }
        if let Some(v) = match_label(trimmed, &["Password", "Pass", "Pwd"]) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                draft.password = v;
            }
            continue;
        }
        if let Some(v) = match_label(trimmed, &["URL", "Website", "Site", "Link"]) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                draft.url = v;
            }
            continue;
        }
        if let Some(v) = match_label(trimmed, &["OTP", "TOTP", "Otp secret", "Totp secret"]) {
            in_notes = false;
            found = true;
            if !v.is_empty() {
                draft.otp_secret = normalize_otp_secret(&v).unwrap_or(v);
            }
            continue;
        }
        if let Some(v) = match_label(trimmed, &["Categories", "Category", "Tags", "Tag"]) {
            in_notes = false;
            found = true;
            draft.tags = v
                .split(',')
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .collect();
            continue;
        }
        if let Some(v) = match_label(trimmed, &["Notes", "Note", "Comment"]) {
            in_notes = true;
            found = true;
            if !v.is_empty() {
                note_lines.push(v);
            }
            continue;
        }
        if in_notes {
            note_lines.push(line.to_string());
        }
    }

    let notes = note_lines.join("\n").trim().to_string();
    if !notes.is_empty() {
        draft.notes = notes;
    }
    if found {
        Some(draft)
    } else {
        None
    }
}

fn looks_like_username(s: &str) -> bool {
    let t = s.trim();
    if t.len() < 2 || t.len() > 128 {
        return false;
    }
    if t.contains(' ') && !t.contains('@') {
        return false;
    }
    !looks_like_password(t) || t.contains('@')
}

fn looks_like_password(s: &str) -> bool {
    let t = s.trim();
    if t.len() < 8 || t.len() > 128 {
        return false;
    }
    if t.contains(' ') {
        return false;
    }
    let has_lower = t.chars().any(|c| c.is_ascii_lowercase());
    let has_upper = t.chars().any(|c| c.is_ascii_uppercase());
    let has_digit = t.chars().any(|c| c.is_ascii_digit());
    let has_symbol = t.chars().any(|c| !c.is_ascii_alphanumeric());
    let classes = [has_lower, has_upper, has_digit, has_symbol]
        .iter()
        .filter(|&&b| b)
        .count();
    // High entropy-ish: length + mixed classes, or long base64-ish.
    classes >= 3 || (t.len() >= 16 && classes >= 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn otpauth_draft() {
        let draft = parse_clipboard_for_quick_add(
            "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example",
        )
        .unwrap();
        assert!(!draft.otp_secret.is_empty());
        assert!(draft.is_useful());
    }

    #[test]
    fn labeled_draft() {
        let draft = parse_clipboard_for_quick_add(
            "Name: GitHub\nUsername: alice\nPassword: s3cretPass!\nURL: https://github.com",
        )
        .unwrap();
        assert_eq!(draft.title, "GitHub");
        assert_eq!(draft.username, "alice");
        assert_eq!(draft.password, "s3cretPass!");
        assert!(draft.url.contains("github"));
    }

    #[test]
    fn password_like_single_line() {
        let draft = parse_clipboard_for_quick_add("aB3$kLm9QpXz").unwrap();
        assert_eq!(draft.password, "aB3$kLm9QpXz");
    }

    #[test]
    fn ambiguous_fails_closed() {
        assert!(parse_clipboard_for_quick_add("hello world how are you").is_none());
    }
}
