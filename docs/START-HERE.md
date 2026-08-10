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
| `specs/backend/v0.3.0-ux-design.md` | v0.3.0 palette / pins / favicons |
| `specs/backend/v0.4.0-mobile-ux-design.md` | v0.4.0 swipe + biometric |
| `specs/backend/v0.5.0-security-hygiene-design.md` | v0.5.0 memory hygiene + auto-lock policy |
| `specs/backend/v0.6.0-backup-portability-design.md` | v0.6.0 KDF transparency + atomic vault writes |
| `specs/backend/v0.6.1-custom-fields-ui-design.md` | Custom fields editor UI + Next.js 16 |
| `specs/backend/v0.7.0-offline-portable-security-design.md` | Offline-first + USB portable + integrity warn |
| `specs/backend/v0.8.0-totp-interop-design.md` | TOTP (otpauth) + CSV interop |
| `specs/backend/v0.9.0-mobile-installers-design.md` | v0.9.0 Android/iOS sideload installers + CI |
| `specs/backend/post-0.9.0-friction-hygiene-umbrella.md` | Phase E bands v0.10–v0.13 |
| `specs/backend/v0.10.0-generate-capture-design.md` | v0.10 generator / quick-add / soft-delete |
| `specs/backend/v0.11.0-password-health-design.md` | v0.11 password health + optional HIBP |
| `specs/backend/v0.12.0-desktop-fill-match-design.md` | v0.12 desktop autotype + title match (Windows first) |
| `specs/backend/v0.13.0-vault-richness-design.md` | v0.13 snapshots / attachments / structured notes |
| `docs/threat-model.md` | Threat assumptions (v2: desktop + mobile) |
| `docs/roadmap.md` | Security, UX, self-signed multi-platform plan |
| `docs/release-checklist.md` | Tag, checksums, self-signed publish steps |
| `docs/platforms.md` | Desktop + mobile matrix, data dir, keyring |
| `docs/signet-ship.md` | Signet CI secrets + ship collect for mobile releases |
| `signet.toml` | Signet multi-target ship config (self path) |

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
