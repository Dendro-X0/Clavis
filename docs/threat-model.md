# Threat model (v2)

Supersedes informal v1 notes for **desktop now** and **mobile later**. Clavis remains local-first OSS with self-signed / unsigned distribution.

## Assets

- Master password and derived vault key material (in-memory while unlocked)
- Entry secrets (passwords, tokens, notes, TOTP seeds)
- Encrypted vault blob on disk (`vault.km`) and encrypted backups
- Optional OS keyring secret used only to unlock (not a substitute for the master password recovery)

## Trust boundary

| Layer | Trust |
|-------|--------|
| `vault-core` (Rust) | Holds KDF + AEAD; zeroizes key, salt, entry secrets on session drop; scrub encode/decode plaintext buffers |
| Tauri commands | Thin IPC; no logging of secrets |
| React UI | Displays secrets only when unlocked; must not persist master key |
| OS | Filesystem, clipboard, keyring, screenshots — outside Clavis control |

## Desktop threats & mitigations

| Threat | Mitigation | Status |
|--------|------------|--------|
| Disk theft / casual browse | Argon2id + AES-256-GCM; portable `data/` not in Documents by default | Done |
| Tear-write / power loss mid-persist | Atomic tmp + fsync + replace; orphan `.tmp` cleanup; `.bak` recovery on Windows | Done (v0.6.0 audit) |
| Wrong password | AEAD fail → closed | Done |
| Accidental cloud sync of plaintext | No Clavis cloud; export is encrypted backup | Done |
| Clipboard residue | Configurable clear (default 15s new installs); sequential user→pass | Done / improving (v0.7.0) |
| Idle / background exposure | Auto-lock idle timer; optional lock-on-hide (`lockOnHide`, default on) | Done (v0.5.0 Settings) |
| Malware with same-user memory access while unlocked | Out of scope while unlocked; lock/drop scrub shortens window (allocator residual possible) — **not antivirus** | Explicit |
| Evil maid + weak master password offline | Strong password + KDF cost; vault SHA-256 fingerprint warns if `vault.km` changed since last unlock | Explicit / improving (v0.7.0) |
| Network exfil / host intent leak | Offline-first: `allowNetwork` default off; favicon fetch gated | Done (v0.7.0) |
| Non-portable data path on USB | Warn + one-click Make portable into `{exe}/data/` | Done (v0.7.0) |
| TOTP seed exposure | Same lock/scrub as passwords; list shows `hasOtp` only; codes via IPC while unlocked | Done (v0.8.0) |
| Generator plaintext in UI | Session-only history (≤5); wipe on lock/apply/dismiss; never persisted in `vault.km` | Done (v0.10) |
| Soft-delete still decryptable | Trash is not secure erase until purge; document retain window; lifecycle owned by `vault-core` only | Done (v0.10) |
| Password health report leaks secrets to UI | Findings are ids/titles only; scoring in Rust | Done (v0.11) |
| Optional HIBP k-anonymity | Default off; requires `allowNetwork` + `checkBreaches`; one-shot; 5-char SHA-1 prefix only | Done (v0.11) |
| Autotype to wrong window | Confirm shows foreground title; re-check immediately before SendInput; abort on change; default off | Done (v0.12) |
| Foreground title spoofing | Suggestions are heuristics only; never auto-fill without confirm | Done (v0.12) |
| Always-on input hooks | No persistent keylogger; event-driven fill only while unlocked | Done (v0.12) |
| Tampered installer (self-signed) | SHA-256 on releases; prefer build-from-tag | Process |
| Supply-chain (deps) | Lockfiles; CI on `main` / tags | Process |

## Mobile threats (Phase C preview)

| Threat | Mitigation | Status |
|--------|------------|--------|
| Device backup / iCloud / Google backup of app data | Vault stays Argon2id + AES-GCM at rest under OS app data; document that OS backups may copy ciphertext | Documented — `docs/platforms.md` |
| Screenshots / app switcher thumbnails | Prefer secure/FLAG_SECURE (or iOS equivalent) when plugin/API exists | Planned — not wired in preview shell |
| Notification leakage | App never schedules notifications containing secrets | Done by policy (no notification features) |
| Biometric / keyring unlock | Opt-in Settings only (default off); OS biometric on mobile + keyring; master password recovers | Done (v0.4.0) |
| Shared / lost phone | Auto-lock settings; remote wipe is OS-level only | Done (auto-lock) / Explicit (wipe) |
| Sideload / APK integrity | Checksums + build-from-tag (same OSS model as desktop) | Process |
| Clipboard on mobile | Sequential copy + clear timers still apply in WebView | Done / improving |
| Optional favicon fetch | Off by default; requires `allowNetwork`; one-shot cache under `data/icons/` | Documented / gated (v0.7.0) |

## Self-signed distribution

Self-signed or unsigned binaries are a **trust-on-first-use** model:

1. User verifies tag + checksum (or builds from source).
2. OS warnings (SmartScreen / Gatekeeper) are expected — document in README.
3. Not a substitute for code signing reputation; do not over-claim.

## Non-goals

- Clavis-operated sync or accounts
- Protecting secrets from a fully compromised OS while the vault is unlocked
- Guaranteeing safety of weak master passwords against unbounded offline attack
- Antivirus / malware scanning / claiming immunity to same-user attacks while unlocked

## Review triggers

Update this doc when adding: autofill/autotype, TOTP, mobile shell, file-based sync, or hardware-key unlock.
