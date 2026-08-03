# Vault file format (`vault.km`)

Binary layout (version 1):

1. Magic: `kmvault` (7 bytes ASCII)
2. Version: `u8` = `1`
3. Salt: 16 random bytes
4. Argon2id params: `m_cost` u32 LE, `t_cost` u32 LE, `p_cost` u32 LE
5. Nonce: 12 bytes (AES-256-GCM)
6. Ciphertext: AES-256-GCM over UTF-8 JSON `VaultDocument`

Wrong password → AEAD failure (no partial plaintext).

Encrypted backups are the same blob as `vault.km`. Header fields (magic, version, salt, Argon2id params, nonce) can be **peeked without a password**; ciphertext still requires the master password. Defaults: `m_cost=19456` (~19 MiB), `t_cost=2`, `p_cost=1`. Weaker params are allowed on import; the app can re-wrap with current defaults (`upgrade_kdf_to_defaults`).

## Durability

Persists use **atomic replace**: write `vault.km.tmp` → `fsync` → replace `vault.km` (Unix rename-over; Windows aside-to-`.bak` then rename). Orphan `.tmp` / leftover `.bak` are cleaned on open; if only `.bak` remains after a crash, it is restored.
