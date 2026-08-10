//! Local password health scoring (no network).

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::model::{Entry, EntryType};

/// Compact offline denylist (common leaked / trivial passwords). Lowercased.
const COMMON_PASSWORDS: &[&str] = &[
    "password",
    "password1",
    "password123",
    "123456",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "qwerty123",
    "abc123",
    "letmein",
    "welcome",
    "admin",
    "admin123",
    "login",
    "master",
    "monkey",
    "dragon",
    "baseball",
    "iloveyou",
    "trustno1",
    "sunshine",
    "princess",
    "football",
    "shadow",
    "superman",
    "michael",
    "jennifer",
    "hunter2",
    "passw0rd",
    "p@ssw0rd",
    "p@ssword",
    "changeme",
    "secret",
    "default",
    "root",
    "toor",
    "pass",
    "test",
    "test123",
    "guest",
    "user",
    "user123",
    "asdfasdf",
    "1q2w3e4r",
    "zaq12wsx",
    "qazwsx",
    "password!",
    "welcome1",
    "hello123",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthFindingKind {
    Empty,
    Short,
    WeakCharset,
    Reused,
    Common,
    /// Set only when an external breach check confirms a hit.
    Breached,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthSeverity {
    Info,
    Warn,
    High,
}

impl HealthFindingKind {
    pub fn severity(self) -> HealthSeverity {
        match self {
            Self::Empty | Self::Short | Self::Common | Self::Breached => HealthSeverity::High,
            Self::Reused | Self::WeakCharset => HealthSeverity::Warn,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthFinding {
    pub entry_id: String,
    pub title: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub kind: HealthFindingKind,
    pub severity: HealthSeverity,
    /// For reuse groups: other entry ids sharing the same password.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_entry_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
    pub findings: Vec<HealthFinding>,
    pub scored_entries: usize,
    pub workspace_scoped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthReportOptions {
    /// When true, score every workspace; otherwise active workspace only.
    #[serde(default)]
    pub all_workspaces: bool,
    /// When true, include soft-deleted entries (default false).
    #[serde(default)]
    pub include_trash: bool,
}

impl Default for HealthReportOptions {
    fn default() -> Self {
        Self {
            all_workspaces: false,
            include_trash: false,
        }
    }
}

struct ScoredEntry<'a> {
    entry: &'a Entry,
    workspace_id: &'a str,
    workspace_name: &'a str,
}

/// Score a slice of `(workspace_id, workspace_name, entry)` references.
pub fn score_entries(
    entries: &[(&str, &str, &Entry)],
    options: &HealthReportOptions,
) -> HealthReport {
    let scored: Vec<ScoredEntry<'_>> = entries
        .iter()
        .filter(|(_, _, e)| options.include_trash || !e.is_deleted())
        .map(|(wid, wname, e)| ScoredEntry {
            entry: e,
            workspace_id: wid,
            workspace_name: wname,
        })
        .collect();

    let mut findings: Vec<HealthFinding> = Vec::new();

    // Reuse map: password -> entry ids
    let mut by_password: HashMap<&str, Vec<usize>> = HashMap::new();
    for (idx, s) in scored.iter().enumerate() {
        let pw = s.entry.password.as_str();
        if pw.is_empty() {
            continue;
        }
        by_password.entry(pw).or_default().push(idx);
    }

    for (idx, s) in scored.iter().enumerate() {
        let pw = s.entry.password.as_str();
        let expects_secret = matches!(
            s.entry.entry_type,
            EntryType::Login | EntryType::Api | EntryType::Custom
        );

        if pw.is_empty() {
            if expects_secret {
                findings.push(finding(s, HealthFindingKind::Empty, Vec::new()));
            }
            continue;
        }

        if pw.trim().len() < 8 {
            findings.push(finding(s, HealthFindingKind::Short, Vec::new()));
        }

        if is_weak_charset(pw) {
            findings.push(finding(s, HealthFindingKind::WeakCharset, Vec::new()));
        }

        if is_common_password(pw) {
            findings.push(finding(s, HealthFindingKind::Common, Vec::new()));
        }

        if let Some(group) = by_password.get(pw) {
            if group.len() > 1 {
                let related: Vec<String> = group
                    .iter()
                    .copied()
                    .filter(|i| *i != idx)
                    .map(|i| scored[i].entry.id.clone())
                    .collect();
                findings.push(finding(s, HealthFindingKind::Reused, related));
            }
        }
    }

    findings.sort_by(|a, b| {
        severity_rank(a.severity)
            .cmp(&severity_rank(b.severity))
            .then(a.title.cmp(&b.title))
            .then(format!("{:?}", a.kind).cmp(&format!("{:?}", b.kind)))
    });

    HealthReport {
        findings,
        scored_entries: scored.len(),
        workspace_scoped: !options.all_workspaces,
    }
}

fn severity_rank(s: HealthSeverity) -> u8 {
    match s {
        HealthSeverity::High => 0,
        HealthSeverity::Warn => 1,
        HealthSeverity::Info => 2,
    }
}

fn finding(s: &ScoredEntry<'_>, kind: HealthFindingKind, related: Vec<String>) -> HealthFinding {
    HealthFinding {
        entry_id: s.entry.id.clone(),
        title: s.entry.title.clone(),
        workspace_id: s.workspace_id.to_string(),
        workspace_name: s.workspace_name.to_string(),
        kind,
        severity: kind.severity(),
        related_entry_ids: related,
    }
}

fn is_weak_charset(password: &str) -> bool {
    if password.len() >= 14 {
        return false;
    }
    let has_lower = password.chars().any(|c| c.is_ascii_lowercase());
    let has_upper = password.chars().any(|c| c.is_ascii_uppercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_symbol = password.chars().any(|c| !c.is_ascii_alphanumeric());
    let classes = [has_lower, has_upper, has_digit, has_symbol]
        .iter()
        .filter(|&&b| b)
        .count();
    classes < 3
}

fn is_common_password(password: &str) -> bool {
    let lower = password.to_ascii_lowercase();
    COMMON_PASSWORDS.iter().any(|c| *c == lower.as_str())
}

/// SHA-1 hex (uppercase) for HIBP k-anonymity — kept in vault-core for one hash owner.
pub fn password_sha1_hex(password: &str) -> String {
    use sha1::{Digest, Sha1};
    let digest = Sha1::digest(password.as_bytes());
    digest.iter().map(|b| format!("{b:02X}")).collect()
}

/// Split SHA-1 hex into HIBP range prefix (5) + suffix.
pub fn hibp_range_parts(sha1_hex: &str) -> Option<(&str, &str)> {
    if sha1_hex.len() != 40 {
        return None;
    }
    Some((&sha1_hex[..5], &sha1_hex[5..]))
}

/// True when `suffix` appears as a line start in an HIBP range response body.
pub fn hibp_range_contains_suffix(body: &str, suffix: &str) -> bool {
    let needle = suffix.to_ascii_uppercase();
    for line in body.lines() {
        let part = line.split(':').next().unwrap_or("").trim();
        if part.eq_ignore_ascii_case(&needle) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Entry, EntryType};

    fn entry(title: &str, password: &str) -> Entry {
        let mut e = Entry::new(EntryType::Login, title);
        e.password = password.into();
        e
    }

    #[test]
    fn detects_reuse_short_weak_common() {
        let a = entry("A", "password");
        let b = entry("B", "password");
        let c = entry("C", "Ab1");
        let rows = [
            ("w1", "Personal", &a),
            ("w1", "Personal", &b),
            ("w1", "Personal", &c),
        ];
        let report = score_entries(&rows, &HealthReportOptions::default());
        assert!(report.findings.iter().any(|f| f.kind == HealthFindingKind::Reused));
        assert!(report.findings.iter().any(|f| f.kind == HealthFindingKind::Common));
        assert!(report.findings.iter().any(|f| f.kind == HealthFindingKind::Short));
        assert!(report
            .findings
            .iter()
            .any(|f| f.kind == HealthFindingKind::WeakCharset));
    }

    #[test]
    fn skips_trash_by_default() {
        let mut trashed = entry("Gone", "password");
        trashed.deleted_at = Some(chrono::Utc::now());
        let live = entry("Live", "Unique-Str0ng!Pass");
        let rows = [("w1", "Personal", &trashed), ("w1", "Personal", &live)];
        let report = score_entries(&rows, &HealthReportOptions::default());
        assert_eq!(report.scored_entries, 1);
        assert!(report.findings.is_empty());
    }

    #[test]
    fn hibp_helpers() {
        let hex = password_sha1_hex("password");
        assert_eq!(hex.len(), 40);
        let (prefix, suffix) = hibp_range_parts(&hex).unwrap();
        assert_eq!(prefix.len(), 5);
        assert_eq!(suffix.len(), 35);
        let body = format!("{suffix}:100\nABCDEF01234567890123456789012345678:1\n");
        assert!(hibp_range_contains_suffix(&body, suffix));
        assert!(!hibp_range_contains_suffix(&body, "00000000000000000000000000000000000"));
    }
}
