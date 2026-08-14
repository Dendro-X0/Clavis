# Architecture

Clavis splits **crypto and persistence** (Rust) from **presentation** (static Next.js UI) with **Tauri IPC** in between. See [features.md](features.md) for product purpose and [frontend-spec.md](frontend-spec.md) for UI structure.

```
apps/web (Next.js static export)
    │  invoke()
    ▼
apps/desktop | apps/mobile (Tauri commands via clavis-shell)
    │
    ▼
crates/vault-core (Argon2id + AES-256-GCM vault.km)
    │
    ▼
{data_dir}/vault.km
{data_dir}/config.json
{data_dir}/attachments/   (encrypted sidecars, v0.13+)
{data_dir}/snapshots/     (encrypted vault copies, v0.13+)
```

Desktop default `data_dir`: `{executable_directory}/data/` (portable). User may point at a synced folder (Syncthing/USB); external file changes while unlocked trigger lock.

## Crates and apps

| Component | Responsibility |
|-----------|----------------|
| `vault-core` | KDF, AEAD, entry model, workspaces, import/export, soft-delete, snapshots |
| `clavis-shell` | Shared Tauri state, settings persistence, IPC handlers |
| `apps/web` | Gate, dashboard, settings, command palette — no master key in JS |
| `apps/desktop` | Windows / macOS / Linux shell, clipboard, autotype (Windows) |
| `apps/mobile` | Android / iOS preview shell, compact layout, biometrics plugin |

## IPC commands (summary)

Vault lock/unlock, entry CRUD, workspaces, import/export, settings, clipboard helpers, path pickers, keyring unlock, password health, autotype. Handler list: `crates/clavis-shell/src/commands.rs`.

## Locking and secrets lifecycle

- Master password always required for recovery.
- Optional OS keyring for convenience unlock (off by default).
- Auto-lock on idle timeout and when the window is hidden.
- Clipboard auto-clear after configured seconds.
- Session drop zeroizes derived keys and scrubs sensitive UI state.

Threat boundaries: [threat-model.md](threat-model.md).
