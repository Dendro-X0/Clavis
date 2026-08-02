# START HERE — Keys Manager

## What this is

A **local-first**, **portable** credential manager. No cloud accounts. The master password unlocks an AES-256-GCM vault stored only under the app install directory.

## Layout

| Path | Role |
|------|------|
| `crates/vault-core` | Crypto, vault format, CRUD, import/export |
| `apps/desktop/src-tauri` | Tauri v2 shell + IPC commands |
| `apps/web` | Next.js static UI + Tailwind |
| `specs/backend/vault-core-design.md` | Vault format contract |
| `docs/threat-model.md` | Threat assumptions |

## Dev loop

```bash
pnpm install
pnpm dev              # desktop (Tauri)
pnpm dev:web          # UI only
pnpm test:vault       # Rust vault-core tests
```

1. Change vault logic → `pnpm test:vault`
2. Change UI → `pnpm dev:web` or `pnpm dev`
3. Never log secrets from the frontend

## Portable install

Ship a user-writable folder (not Program Files). The app writes `data/` next to the binary.
