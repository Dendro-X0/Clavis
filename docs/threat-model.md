# Threat model (v2)

Supersedes informal v1 notes for **desktop now** and **mobile later**. Clavis remains local-first OSS with self-signed / unsigned distribution.

## Assets

- Master password and derived vault key material (in-memory while unlocked)
- Entry secrets (passwords, tokens, notes, TOTP seeds when added)
- Encrypted vault blob on disk (`vault.km`) and encrypted backups
- Optional OS keyring secret used only to unlock (not a substitute for the master password recovery)

## Trust boundary

| Layer | Trust |
|-------|--------|
| `vault-core` (Rust) | Holds KDF + AEAD; session drops key on lock |
| Tauri commands | Thin IPC; no logging of secrets |
| React UI | Displays secrets only when unlocked; must not persist master key |
| OS | Filesystem, clipboard, keyring, screenshots — outside Clavis control |

## Desktop threats & mitigations

| Threat | Mitigation | Status |
|--------|------------|--------|
| Disk theft / casual browse | Argon2id + AES-256-GCM; portable `data/` not in Documents by default | Done |
| Wrong password | AEAD fail → closed | Done |
| Accidental cloud sync of plaintext | No Clavis cloud; export is encrypted backup | Done |
| Clipboard residue | Configurable clear; sequential user→pass reduces multi-secret dwell | Done / improving |
| Idle / background exposure | Auto-lock; lock on window hide | Done |
| Malware with same-user memory access while unlocked | Out of scope | Explicit |
| Evil maid + weak master password offline | Out of scope for strong passwords; document KDF cost | Explicit |
| Compromised OS keyring | Optional feature; disable in Settings | Documented |
| Tampered installer (self-signed) | SHA-256 on releases; prefer build-from-tag | Process |
| Supply-chain (deps) | Lockfiles; CI on `main` / tags | Process |

## Mobile threats (Phase C preview)

| Threat | Mitigation | Status |
|--------|------------|--------|
| Device backup / iCloud / Google backup of app data | Vault stays Argon2id + AES-GCM at rest under OS app data; document that OS backups may copy ciphertext | Documented — `docs/platforms.md` |
| Screenshots / app switcher thumbnails | Prefer secure/FLAG_SECURE (or iOS equivalent) when plugin/API exists | Planned — not wired in preview shell |
| Notification leakage | App never schedules notifications containing secrets | Done by policy (no notification features) |
| Biometric / keyring unlock | Optional keyring / Keystore path; master password recovers vault | Preview — same IPC as desktop; OS coverage varies |
| Shared / lost phone | Auto-lock settings; remote wipe is OS-level only | Done (auto-lock) / Explicit (wipe) |
| Sideload / APK integrity | Checksums + build-from-tag (same OSS model as desktop) | Process |
| Clipboard on mobile | Sequential copy + clear timers still apply in WebView | Done / improving |

## Self-signed distribution

Self-signed or unsigned binaries are a **trust-on-first-use** model:

1. User verifies tag + checksum (or builds from source).
2. OS warnings (SmartScreen / Gatekeeper) are expected — document in README.
3. Not a substitute for code signing reputation; do not over-claim.

## Non-goals

- Clavis-operated sync or accounts
- Protecting secrets from a fully compromised OS while the vault is unlocked
- Guaranteeing safety of weak master passwords against unbounded offline attack

## Review triggers

Update this doc when adding: autofill/autotype, TOTP, mobile shell, file-based sync, or hardware-key unlock.
