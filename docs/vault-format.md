# Vault file format (`vault.km`)

Binary layout (version 1):

1. Magic: `kmvault` (7 bytes ASCII)
2. Version: `u8` = `1`
3. Salt: 16 random bytes
4. Argon2id params: `m_cost` u32 LE, `t_cost` u32 LE, `p_cost` u32 LE
5. Nonce: 12 bytes (AES-256-GCM)
6. Ciphertext: AES-256-GCM over UTF-8 JSON `VaultDocument`

Wrong password → AEAD failure (no partial plaintext).
