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

## IPC commands (summary)

Vault lock/unlock, entry CRUD, workspaces, import/export, settings, clipboard helpers, path pickers, keyring unlock. See `apps/desktop/src-tauri/src/commands.rs` for the full handler list.

## Locking

- Master password always required for recovery.
- Optional OS keyring remember-unlock.
- Auto-lock on idle timeout and when the window is hidden.
- Clipboard auto-clear after configured seconds.
