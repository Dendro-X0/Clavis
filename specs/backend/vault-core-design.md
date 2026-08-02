# vault-core design

## Purpose

Local-first encrypted credential store. All secrets stay in an AEAD blob under the app portable `data/` directory.

## Format (`vault.km`)

1. Magic: `kmvault` (7 bytes)
2. Version: `u8` = 1
3. Salt: 16 bytes
4. Argon2id params: `m_cost` u32 LE, `t_cost` u32 LE, `p_cost` u32 LE
5. Nonce: 12 bytes (AES-256-GCM)
6. Ciphertext: remainder (JSON plaintext of `VaultDocument`)

## Invariants

- Wrong password → decrypt failure; no partial document.
- Unlocked session holds key in memory; `lock` zeroizes.
- Persist re-encrypts whole document (v1).
- Import/export of encrypted backups uses the same file format.

## Entry model

`Entry`: id, type (login|note|api|custom), title, username, password, url, notes, custom_fields, tags, timestamps.
