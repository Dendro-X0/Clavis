//! Password / passphrase / PIN generator (session consumers own history).

use rand::Rng;
use serde::{Deserialize, Serialize};

/// Built-in generation styles.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GeneratorPreset {
    #[default]
    Strong,
    Passphrase,
    Pin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateOptions {
    pub preset: GeneratorPreset,
    /// Character length for Strong / PIN; word count for Passphrase.
    pub length: usize,
    #[serde(default = "default_true")]
    pub uppercase: bool,
    #[serde(default = "default_true")]
    pub lowercase: bool,
    #[serde(default = "default_true")]
    pub digits: bool,
    #[serde(default = "default_true")]
    pub symbols: bool,
    /// Drop ambiguous glyphs (0/O, 1/l/I, etc.) from Strong charset.
    #[serde(default)]
    pub avoid_ambiguous: bool,
}

fn default_true() -> bool {
    true
}

impl Default for GenerateOptions {
    fn default() -> Self {
        Self {
            preset: GeneratorPreset::Strong,
            length: 20,
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
            avoid_ambiguous: false,
        }
    }
}

impl GenerateOptions {
    pub fn strong(length: usize) -> Self {
        Self {
            preset: GeneratorPreset::Strong,
            length,
            ..Self::default()
        }
    }

    pub fn passphrase(words: usize) -> Self {
        Self {
            preset: GeneratorPreset::Passphrase,
            length: words,
            uppercase: false,
            lowercase: true,
            digits: false,
            symbols: false,
            avoid_ambiguous: false,
        }
    }

    pub fn pin(length: usize) -> Self {
        Self {
            preset: GeneratorPreset::Pin,
            length,
            uppercase: false,
            lowercase: false,
            digits: true,
            symbols: false,
            avoid_ambiguous: false,
        }
    }
}

/// Compact word list for passphrases (not full EFF — enough entropy with 4–6 words).
const WORDS: &[&str] = &[
    "able", "acid", "acre", "aged", "also", "amber", "angle", "apple", "april", "arena",
    "armor", "arrow", "atlas", "audio", "autumn", "avenue", "award", "bacon", "badge", "baker",
    "bamboo", "banana", "banner", "barley", "basin", "beach", "beacon", "beard", "beast", "beaver",
    "beige", "berry", "bike", "birch", "blade", "blank", "blast", "blaze", "blend", "bliss",
    "bloom", "bluff", "board", "boast", "bonus", "boost", "booth", "borne", "bound", "brave",
    "bread", "breeze", "brick", "bride", "brief", "brisk", "broad", "broke", "brook", "broom",
    "brush", "buddy", "build", "bulb", "bulge", "bully", "bunch", "bunny", "cabin", "cable",
    "cactus", "camel", "camp", "canal", "candy", "cannon", "canoe", "canvas", "canyon", "cape",
    "carbon", "cargo", "carol", "carve", "castle", "catch", "cause", "cedar", "cello", "chain",
    "chair", "chalk", "champ", "chaos", "charm", "chart", "chase", "cheap", "check", "chess",
    "chest", "chick", "chief", "child", "chili", "chill", "chimney", "china", "chip", "choir",
    "chord", "chore", "chose", "chunk", "cider", "cigar", "cinch", "circa", "civic", "civil",
    "claim", "clamp", "clang", "clash", "clasp", "class", "clean", "clear", "clerk", "click",
    "cliff", "climb", "cling", "clip", "cloak", "clock", "clone", "close", "cloth", "cloud",
    "clown", "club", "clump", "coach", "coast", "cobra", "cocoa", "coconut", "coffee", "coil",
    "coin", "cola", "cold", "colon", "color", "column", "combo", "comet", "comic", "comma",
    "conch", "condo", "cone", "cook", "cool", "copper", "coral", "cord", "cork", "corn",
    "corner", "cosmic", "cost", "cotton", "couch", "cough", "could", "count", "coupe", "court",
    "cover", "cozy", "crab", "craft", "cramp", "crane", "crash", "crate", "crave", "crawl",
    "crazy", "cream", "creek", "creep", "crest", "crew", "crib", "cried", "crime", "crisp",
    "crook", "crop", "cross", "crowd", "crown", "crude", "cruel", "crush", "crust", "crypt",
    "cube", "cubic", "cuckoo", "cult", "cupid", "curb", "cure", "curl", "curry", "curse",
    "curve", "cyclic", "cylinder", "cynic", "cypress", "daily", "dairy", "daisy", "dance",
    "dandy", "danger", "daring", "dark", "dart", "dash", "data", "date", "dawn", "daze",
];

const UPPER: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const DIGITS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}?,.";
const AMBIGUOUS: &[u8] = b"0OIl1";

fn filter_ambiguous(chars: &[u8], avoid: bool) -> Vec<u8> {
    if !avoid {
        return chars.to_vec();
    }
    chars
        .iter()
        .copied()
        .filter(|c| !AMBIGUOUS.contains(c))
        .collect()
}

/// Generate a password / passphrase / PIN from options.
pub fn generate_password(options: &GenerateOptions) -> Result<String, String> {
    match options.preset {
        GeneratorPreset::Strong => generate_strong(options),
        GeneratorPreset::Passphrase => generate_passphrase(options.length),
        GeneratorPreset::Pin => generate_pin(options.length),
    }
}

fn generate_strong(options: &GenerateOptions) -> Result<String, String> {
    let len = options.length.clamp(8, 128);
    let mut pools: Vec<Vec<u8>> = Vec::new();
    if options.uppercase {
        pools.push(filter_ambiguous(UPPER, options.avoid_ambiguous));
    }
    if options.lowercase {
        pools.push(filter_ambiguous(LOWER, options.avoid_ambiguous));
    }
    if options.digits {
        pools.push(filter_ambiguous(DIGITS, options.avoid_ambiguous));
    }
    if options.symbols {
        pools.push(SYMBOLS.to_vec());
    }
    pools.retain(|p| !p.is_empty());
    if pools.is_empty() {
        return Err("select at least one character class".into());
    }

    let mut charset = Vec::new();
    for p in &pools {
        charset.extend_from_slice(p);
    }

    let mut rng = rand::thread_rng();
    let mut out = Vec::with_capacity(len);
    // Guarantee one from each enabled class when length allows.
    for pool in &pools {
        if out.len() >= len {
            break;
        }
        let idx = rng.gen_range(0..pool.len());
        out.push(pool[idx]);
    }
    while out.len() < len {
        let idx = rng.gen_range(0..charset.len());
        out.push(charset[idx]);
    }
    // Fisher–Yates shuffle so guaranteed chars aren't prefix-biased.
    for i in (1..out.len()).rev() {
        let j = rng.gen_range(0..=i);
        out.swap(i, j);
    }
    Ok(out.into_iter().map(|b| b as char).collect())
}

fn generate_passphrase(word_count: usize) -> Result<String, String> {
    let n = word_count.clamp(3, 12);
    let mut rng = rand::thread_rng();
    let words: Vec<&str> = (0..n)
        .map(|_| {
            let idx = rng.gen_range(0..WORDS.len());
            WORDS[idx]
        })
        .collect();
    Ok(words.join("-"))
}

fn generate_pin(length: usize) -> Result<String, String> {
    let len = length.clamp(4, 12);
    let mut rng = rand::thread_rng();
    Ok((0..len)
        .map(|_| {
            let d = rng.gen_range(0..10u8);
            (b'0' + d) as char
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strong_respects_length_and_classes() {
        let opts = GenerateOptions {
            length: 24,
            avoid_ambiguous: true,
            ..GenerateOptions::strong(24)
        };
        let pw = generate_password(&opts).unwrap();
        assert_eq!(pw.len(), 24);
        assert!(pw.chars().any(|c| c.is_ascii_uppercase()));
        assert!(pw.chars().any(|c| c.is_ascii_lowercase()));
        assert!(pw.chars().any(|c| c.is_ascii_digit()));
        assert!(!pw.contains('0') && !pw.contains('O') && !pw.contains('I') && !pw.contains('l'));
    }

    #[test]
    fn passphrase_word_count() {
        let pw = generate_password(&GenerateOptions::passphrase(5)).unwrap();
        assert_eq!(pw.split('-').count(), 5);
    }

    #[test]
    fn pin_digits_only() {
        let pw = generate_password(&GenerateOptions::pin(6)).unwrap();
        assert_eq!(pw.len(), 6);
        assert!(pw.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn empty_charset_errors() {
        let opts = GenerateOptions {
            uppercase: false,
            lowercase: false,
            digits: false,
            symbols: false,
            ..GenerateOptions::strong(16)
        };
        assert!(generate_password(&opts).is_err());
    }
}
