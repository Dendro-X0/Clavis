//! Rank entries against a foreground window title (heuristic; no browser URL).

use serde::{Deserialize, Serialize};

use crate::model::Entry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MatchCandidate {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub score: u32,
}

/// Score active (caller-filtered) entries against a window title string.
pub fn rank_entries_for_title(
    title: &str,
    entries: &[(&str, &str, &Entry)],
    limit: usize,
) -> Vec<MatchCandidate> {
    let needle = normalize(title);
    if needle.is_empty() {
        return Vec::new();
    }
    let tokens = tokenize(&needle);
    let mut out: Vec<MatchCandidate> = Vec::new();

    for (wid, wname, entry) in entries {
        if entry.is_deleted() {
            continue;
        }
        let mut score = 0u32;
        let et = normalize(&entry.title);
        let eu = normalize(&entry.url);
        let euser = normalize(&entry.username);

        if !et.is_empty() && (needle.contains(&et) || et.contains(&needle)) {
            score += 50;
        }
        if !eu.is_empty() {
            if needle.contains(&eu) || eu.contains(&needle) {
                score += 40;
            }
            // Host-ish token from URL
            if let Some(host) = url_host_token(&entry.url) {
                let h = normalize(&host);
                if !h.is_empty() && needle.contains(&h) {
                    score += 35;
                }
            }
        }
        for t in &tokens {
            if t.len() < 3 {
                continue;
            }
            if et.contains(t) {
                score += 8;
            }
            if eu.contains(t) {
                score += 6;
            }
            if euser.contains(t) {
                score += 3;
            }
            for tag in &entry.tags {
                if normalize(tag).contains(t) {
                    score += 4;
                }
            }
        }

        if score > 0 {
            out.push(MatchCandidate {
                entry_id: entry.id.clone(),
                title: entry.title.clone(),
                username: entry.username.clone(),
                url: entry.url.clone(),
                workspace_id: (*wid).to_string(),
                workspace_name: (*wname).to_string(),
                score,
            });
        }
    }

    out.sort_by(|a, b| b.score.cmp(&a.score).then(a.title.cmp(&b.title)));
    out.truncate(limit.max(1).min(10));
    out
}

fn normalize(s: &str) -> String {
    s.trim().to_ascii_lowercase()
}

fn tokenize(s: &str) -> Vec<String> {
    s.split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect()
}

fn url_host_token(url: &str) -> Option<String> {
    let u = url.trim();
    let rest = u
        .strip_prefix("https://")
        .or_else(|| u.strip_prefix("http://"))
        .unwrap_or(u);
    let host = rest.split('/').next()?.split(':').next()?.trim();
    let host = host.strip_prefix("www.").unwrap_or(host);
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Entry, EntryType};

    #[test]
    fn ranks_url_host_in_browser_title() {
        let mut e = Entry::new(EntryType::Login, "GitHub");
        e.url = "https://github.com/login".into();
        e.username = "alice".into();
        let rows = [("w", "Personal", &e)];
        let ranked = rank_entries_for_title("Sign in to GitHub - Google Chrome", &rows, 5);
        assert_eq!(ranked.len(), 1);
        assert!(ranked[0].score >= 35);
    }
}
