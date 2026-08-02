# Threat model (v1)

## Assets

- Master password / derived vault key
- Entry secrets (passwords, tokens, notes)
- Encrypted vault blob on disk

## Out of scope (v1)

- Malware with same-user memory access while unlocked
- Evil maid with unlimited offline brute-force of a weak master password
- Compromised OS keyring when biometric unlock is enabled

## Mitigations

| Threat | Mitigation |
|--------|------------|
| Disk theft / casual browsing | Argon2id + AES-256-GCM; no plaintext vault dumps in Documents |
| Wrong password | AEAD failure → closed |
| Accidental sync of secrets | No cloud; export is explicit encrypted backup |
| Clipboard residue | Configurable clipboard clear |
| Idle exposure | Auto-lock timeout |

## Trust boundary

React UI never holds the master key. Rust session state drops key material on lock.
