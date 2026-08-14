# START HERE — Keys Manager

## What this is

A **local-first**, **portable** credential manager. No cloud accounts. The master password unlocks an AES-256-GCM vault stored only under the app install directory (desktop) or OS app sandbox (mobile preview).

**New to the project?** Read [features.md](features.md) for purpose, design, and a full feature tour (with links to demo GIFs on the [README](../README.md)).

## Layout

| Path | Role |
|------|------|
| `crates/vault-core` | Crypto, vault format, CRUD, import/export |
| `crates/clavis-shell` | Shared Tauri IPC (desktop + mobile) |
| `apps/desktop/src-tauri` | Desktop Tauri entry |
| `apps/mobile/src-tauri` | Mobile preview Tauri entry |
| `apps/web` | Next.js static UI + Tailwind |
| `docs/features.md` | Product purpose, design, feature reference |
| `docs/demos/` | README demo GIFs (embedded in root README) |
| `docs/frontend-spec.md` | UI tokens, shell layout, keyboard contract |
| `docs/architecture.md` | Stack diagram and locking summary |
| `docs/threat-model.md` | Threat assumptions (desktop + mobile) |
| `docs/roadmap.md` | Security, UX, self-signed multi-platform plan |
| `docs/release-checklist.md` | Tag, checksums, self-signed publish steps |
| `docs/platforms.md` | Desktop + mobile matrix, data dir, keyring |
| `docs/signet-ship.md` | Signet CI secrets + ship collect for mobile releases |
| `docs/vault-format.md` | On-disk vault format overview |
| `signet.toml` | Signet multi-target ship config (self path) |
| `specs/backend/` | Versioned design specs (vault, mobile, UX bands) |

## Dev loop

```bash
pnpm install
pnpm dev              # desktop (Tauri)
pnpm dev:web          # UI only
pnpm test:vault       # Rust vault-core tests
pnpm --filter @clavis/mobile android:init   # once (Android SDK)
pnpm --filter @clavis/mobile android:dev
pnpm mobile:ios:init                        # once (macOS + Xcode)
pnpm --filter @clavis/mobile ios:dev
pnpm signet:android                         # APK + Signet sign (needs SDK + keystore)
pnpm signet:ios                             # IPA (macOS); or signet:ios:fixture for package smoke
# Signet: install CLI, run from repo root → `signet doctor`
```

1. Change vault logic → `pnpm test:vault`
2. Change UI → `pnpm dev:web` or `pnpm dev`
3. Never log secrets from the frontend

## Portable install

Ship a user-writable folder (not Program Files). Desktop writes `data/` next to the binary — copy that whole folder for USB migrate. Mobile uses the OS app sandbox.
