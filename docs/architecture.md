# Architecture

```
apps/web (Next.js static)
    │  invoke()
    ▼
apps/desktop/src-tauri (Tauri commands)
    │
    ▼
crates/vault-core (Argon2id + AES-256-GCM vault.km)
    │
    ▼
{exe_dir}/data/vault.km
{exe_dir}/data/config.json
```

## IPC commands

`vault_status`, `create_vault`, `unlock`, `lock`, `list_entries`, `get_entry`, `upsert_entry`, `delete_entry`, `export_vault`, `import_vault`, `import_csv`, `change_master_password`, `get_settings`, `save_settings`, `generate_password`, `read_text_file`, `try_keyring_unlock`, `store_keyring_secret`, `clear_keyring_secret`, `get_data_dir`.

## Locking

- Master password always required for recovery.
- Optional OS keyring remember-unlock.
- Auto-lock on idle timeout and when the window is hidden.
- Clipboard auto-clear after configured seconds.
