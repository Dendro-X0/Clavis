# START HERE — Keys Manager

## What this is

A **local-first**, **portable** credential manager. No cloud accounts. The master password unlocks an AES-256-GCM vault stored only under the app install directory (desktop) or OS app sandbox (mobile preview).

## Layout

| Path | Role |
|------|------|
| `crates/vault-core` | Crypto, vault format, CRUD, import/export |
| `crates/clavis-shell` | Shared Tauri IPC (desktop + mobile) |
| `apps/desktop/src-tauri` | Desktop Tauri entry |
| `apps/mobile/src-tauri` | Mobile preview Tauri entry |
| `apps/web` | Next.js static UI + Tailwind |
| `specs/backend/vault-core-design.md` | Vault format contract |
| `specs/backend/mobile-preview-design.md` | Phase C mobile design |
| `docs/threat-model.md` | Threat assumptions (v2: desktop + mobile) |
| `docs/roadmap.md` | Security, UX, self-signed multi-platform plan |
| `docs/release-checklist.md` | Tag, checksums, self-signed publish steps |
| `docs/platforms.md` | Desktop + mobile matrix, data dir, keyring |

## Dev loop

```bash
pnpm install
pnpm dev              # desktop (Tauri)
pnpm dev:web          # UI only
pnpm test:vault       # Rust vault-core tests
pnpm --filter @clavis/mobile android:init   # once (Android SDK)
pnpm --filter @clavis/mobile android:dev
```

1. Change vault logic → `pnpm test:vault`
2. Change UI → `pnpm dev:web` or `pnpm dev`
3. Never log secrets from the frontend

## Portable install

Ship a user-writable folder (not Program Files). Desktop writes `data/` next to the binary. Mobile uses the OS app sandbox.
