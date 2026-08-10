# Clavis roadmap — security, UX, and platforms

**Status:** living plan (post-0.2.0)  
**Product stance:** local-first OSS credential vault; no cloud account required  
**Signing (near term):** self-signed / developer-signed builds; store listing and Apple/Google signing later

---

## North stars

1. **Security** — strong crypto remains in `vault-core`; UI never holds the master key; clear threat boundaries.
2. **Ease of use** — unlock → find → copy/fill with minimal friction; imports and workspaces stay understandable.
3. **Portability** — one vault format (`vault.km`); data next to the app (or explicit user-chosen path) on every OS.
4. **Cross-platform** — desktop first (Windows / macOS / Linux), then mobile (iOS / Android) via Tauri v2 + shared Rust core.

---

## Platform strategy

```
crates/vault-core          ← single crypto + vault owner (all platforms)
apps/desktop (Tauri)       ← Windows / macOS / Linux
apps/mobile (Tauri mobile) ← iOS / Android (later; same IPC patterns)
apps/web                   ← UI shell (static); platform plugins differ
```

| Track | Approach | Notes |
|-------|----------|--------|
| Desktop | Keep Tauri v2 | Already on Windows; add macOS/Linux CI and bundles |
| Mobile | Tauri 2 mobile | Reuse `vault-core`; thinner UI; biometric unlock via OS |
| Sync | Optional later | Encrypted file sync (user-owned folder / Syncthing), not Clavis cloud |
| Signing | Self-signed now | Document trust model; ship checksums + SBOM when possible |

### Self-signed OSS releases (current policy)

- Publish GitHub Releases with **version tags**, **checksums** (SHA-256), and build instructions.
- Windows: optional Authenticode self-cert for sideload; expect SmartScreen warnings until reputation / EV.
- macOS: ad-hoc or Developer ID when available; Gatekeeper docs for “Open anyway”.
- Linux: AppImage / `.deb` / Flatpak candidates; GPG-sign release assets if a maintainer key exists.
- **Never** claim “verified publisher” until store/notarization is real — README honesty over polish.

---

## Security track

| Priority | Item | Why |
|----------|------|-----|
| P0 | Threat-model refresh for mobile + clipboard + screenshots | Expand `docs/threat-model.md` before mobile ships |
| P0 | Memory hygiene audit (zeroize, lock drops key) | Done (v0.5.0) |
| P1 | Argon2 params / KDF versioning in vault format | Done (v0.6.0) — peek + Settings transparency + upgrade-to-defaults |
| P1 | Autofill / “copy user then pass” timed sequence | Done — sequential copy; **autotype** → v0.12 |
| P1 | Optional PIN / biometric over keyring (desktop + mobile) | Ease of unlock without weakening master password |
| P2 | Secure field reveal (hold-to-show), screen capture flags where OS allows | Hold-to-reveal done (v0.7.0); FLAG_SECURE → v0.9.0 |
| P2 | Integrity: signed vault metadata / tamper detection UX | Fingerprint warn done (v0.7.0); deepen later |
| P2 | Password health (local only) + optional breach pack | Done — v0.11 |
| P3 | Audit logging (local, optional) | Power users / shared machines |
| Later | Hardware key / passkey unlock of vault key wrap | Advanced users; keep master password recovery |

**Non-goals (keep explicit):** no Clavis-operated cloud; no “sync password to our servers.”

---

## Ease-of-use track

| Priority | Item | Why |
|----------|------|-----|
| P0 | Onboarding: create vault → import → first copy | Empty-state education |
| P0 | Search + keyboard shortcuts (lock, new, search focus) | Done — global search + Ctrl/Cmd+K palette |
| P1 | Autotype / fill helper (desktop) where safe | Planned — v0.12 |
| P1 | TOTP / otpauth fields | Done (v0.8.0) |
| P1 | Favicons / site icons (optional, offline-safe) | v0.3.0 — lettermark + optional cache |
| P1 | Duplicate workspace merge / cleanup | Users already hit duplicate names |
| P1 | Workspace sidebar pins + clipboard clear toast | v0.3.0 |
| P1 | Password generator + clipboard quick-add + soft-delete | Done — v0.10 |
| P1 | URL / app match (opt-in, offline heuristics) | Planned — v0.12 |
| P2 | Password health (length, reuse warnings — local only) | Done — v0.11 |
| P2 | Attachments / snapshots / structured notes | Done — v0.13.0 |
| P2 | Accessible density modes; larger touch targets for mobile | Mobile readiness |
| P3 | Plugins / custom field templates | Stretch |

---

## Suggested phases

### Phase A — Harden 0.2.x (desktop OSS)

- CI: `vault-core` tests + web typecheck + Windows (then Linux) Tauri build
- Release checklist: tag, checksums, self-signed notes in README
- Security: clipboard sequential copy; lock/keyring review against threat model
- UX: shortcuts, onboarding polish, workspace dedupe tools

### Phase B — Multi-desktop

- Official macOS + Linux packages (self-signed / unsigned OSS)
- Path picker for data dir (still portable by default)
- Platform keyring + biometric matrix documented

### Phase C — Mobile preview

- Tauri mobile shell sharing `vault-core`
- Biometric unlock; import via Files / share sheet
- Touch-first entry list; fewer chrome controls
- Update threat model (device backup, screenshots, notifications)

### Phase C.1 — Mobile installers (v0.9.0)

- Sideloadable **Android APK** and **iOS IPA** on GitHub Releases via **Signet** self-sign first
- `signet` keystore / `ios package` / ship CI collect + `TRUST.md` (not Play/App Store)
- Install docs + checksums; stay honest (sideload / developer install)
- Best-effort secure-window / screenshot mitigations where APIs exist

### Phase D — Interop & trust

- Import from Bitwarden / KeePass / browser CSV (documented mapping) — CSV + TOTP done in v0.8.0; folder sync remains
- Optional user-folder sync of `vault.km` (conflict = last-write or explicit merge) — **design:** `specs/backend/v0.14.0-folder-sync-design.md` (LWW blob; data-dir reuse)
- Store signing / notarization / Play + App Store listing when project is ready (not blocking OSS sideload)

### Phase E — Friction & vault hygiene (post-0.9.0)

- **v0.10** — Generator, clipboard quick-add, soft-delete — **done**
- **v0.11** — Local password health; optional HIBP offline / gated network — **done**
- **v0.12** — Desktop autotype + URL/app match (threat-model first) — **done**
- **v0.13** — Attachments, snapshots, structured notes  

Umbrella: `specs/backend/post-0.9.0-friction-hygiene-umbrella.md`  
Keep Phase D folder-sync **after** trash/snapshot owners exist (or with an explicit compat section).

---

## Engineering principles (carry forward)

1. **`vault-core` owns secrets** — new platforms add shells, not second crypto stacks.
2. **Specs before large features** — threat model + short design note for autofill, mobile, sync.
3. **Portable default** — `{app}/data/`; cloud sync is opt-in and file-based.
4. **Honest distribution** — self-signed means clear install warnings and checksums.
5. **OSS cadence** — small tagged releases; prefer reproducible builds over opaque binaries.

---

## Near-term progress

| # | Item | Status |
|---|------|--------|
| 1 | Release checklist + checksums + self-sign docs | Done — `docs/release-checklist.md`, `scripts/checksum-release.mjs`, README |
| 2 | Sequential copy-user-then-password + keyboard shortcuts | Done — **Copy** = user→pass; `/` `Ctrl+K` search, `Ctrl+N` new, `Ctrl+L` lock, `Esc` close |
| 3 | CI matrix: test + Windows build artifact on tag | Done — `.github/workflows/ci.yml` |
| 4 | Threat-model v2 draft (desktop + future mobile) | Done — `docs/threat-model.md` |

### Phase A polish

| Item | Status |
|------|--------|
| Onboarding (create vault steps + dismissible tip) | Done |
| Merge duplicate workspace names | Done — Settings → Workspaces → Merge duplicates |

### Phase B — Multi-desktop

| Item | Status |
|------|--------|
| Windows + Linux + macOS CI builds on tag | Done — matrix in `.github/workflows/ci.yml` |
| Platform + keyring docs | Done — `docs/platforms.md` |
| Optional custom data directory | Done — Settings → Change data folder / portable default |

### Phase C — Mobile preview

| Item | Status |
|------|--------|
| Shared `clavis-shell` + `apps/mobile` Tauri shell | Done — scaffold; Android init per machine |
| Compact / touch UI (<768px) | Done — fewer chrome controls, larger tap targets |
| Threat model mobile rows | Done — `docs/threat-model.md` |
| Platform docs (mobile data + keyring) | Done — `docs/platforms.md` |
| Biometric / secure-window polish | Done biometrics (v0.4.0); FLAG_SECURE later |
| Share-sheet import | Follow-up |

### v0.3.0 — Usability refinements

| Item | Status |
|------|--------|
| Palette: copy credentials + switch workspace | Done |
| Clipboard clear countdown toast | Done |
| Pinned workspaces in sidebar | Done |
| Entry lettermark + optional favicon cache | Done |
| Version bump 0.3.0 | Done |

### v0.4.0 — Mobile UX

| Item | Status |
|------|--------|
| Compact swipe: right = copy login, left = open entry | Done |
| Long-press copy menu (hide granular buttons on compact) | Done |
| OS biometric unlock + password fallback | Done — mobile plugin + Gate |
| Version bump 0.4.0 | Done |

### v0.5.0 — Security & memory hygiene

| Item | Status |
|------|--------|
| Rust: scrub plaintext buffers + lock/drop audit (`zeroize`) | Done |
| Frontend: clear Gate/editor secrets on lock / after use | Done |
| Auto-lock: configurable idle + lock-on-hide policy | Done — Settings `lockOnHide` (default on) |
| Threat model / frontend-spec update | Done |
| Version bump 0.5.0 | Done |

### v0.6.0 — Backup portability & vault durability (done)

| Item | Status |
|------|--------|
| KDF transparency on encrypted export/import (Argon2id params visible) | Done — Settings shows active KDF; export confirm includes params |
| Header peek + warn/upgrade when backup KDF weaker than defaults | Done — `peek_vault_kdf` + Upgrade KDF IPC |
| Atomic `vault.km` write audit (tmp + rename); orphan `.tmp` cleanup | Done |
| Version bump 0.6.0 | Done |

**Parked:** desktop tag CI flake chase beyond workspace `target/` collect fix + release asset attach (`16e6a9e`).

### Post-0.6.0 — Custom fields UI & Next.js 16

| Item | Status |
|------|--------|
| Entry editor custom fields (Email / Phone / freeform) | Done — `specs/backend/v0.6.1-custom-fields-ui-design.md` |
| Search includes custom field labels/values | Done |
| Next.js 15 → 16.2.x (static export) | Done — `next@16.2.12` |

Next: **v0.9.0** mobile installers, then **Phase E** friction & hygiene; **Phase D** folder sync when ready.

### v0.7.0 — Offline-first portable security (done)

| Item | Status |
|------|--------|
| Make portable / USB kit UX + non-portable path warning | Done |
| `allowNetwork` default off; gate favicon HTTP | Done |
| Vault SHA-256 fingerprint mismatch warn on unlock | Done |
| Hold-to-reveal secrets; portable + keyring warn; clipboard default 15s | Done |
| Version bump 0.7.0 | Done |

### v0.8.0 — TOTP & import interop (done)

| Item | Status |
|------|--------|
| First-class `otp_secret` + offline TOTP (SHA-1 / 6 / 30s) | Done |
| Editor + Copy code; Copy login → user → pass → TOTP | Done |
| Bitwarden / KeePass / browser CSV totp column maps | Done |
| Version bump 0.8.0 | Done |

### v0.9.0 — Mobile installers (Android + iOS) — done

Design: `specs/backend/v0.9.0-mobile-installers-design.md`  
**Signing:** [Signet](https://github.com/Dendro-X0/Signet) self path first (`ship.path = "self"`) — local keystore / IPA package / `SHA256SUMS` + `TRUST.md`. Not Play/App Store; graduate path later.

| Item | Status |
|------|--------|
| Root `signet.toml` multi-target (desktop + android + ios) + `.signet/` secrets layout | Done (slice 2–3) — `TRUST.md` present |
| Native project strategy (commit `gen/` vs CI `tauri android/ios init`) | Done — regenerate per machine/CI; `gen/` gitignored |
| `@clavis/mobile` scripts: `ios:init` / `ios:dev` / `ios:build` (+ Android release path) | Done (slice 2) |
| Android: Tauri APK → `signet android keystore|sign` → Release + cert in `TRUST.md` | Done (slice 3) — local proof; CI attach in slice 5 |
| iOS: Tauri `.app` → `signet ios package` → IPA on Release (honest free/ad-hoc notes) | Done (slice 4) — scripts + fixture package L3; full Tauri build on macOS CI (slice 5) |
| `signet ship --ci` / collect / release gate (or merge into existing tag CI) | Done (slice 5) — `signet-ship.yml` + `docs/signet-ship.md`; desktop stays `ci.yml` |
| Platforms + release-checklist + README (Signet verify / sideload) | Done (slice 5) |
| Secure-window / FLAG_SECURE (or iOS snapshot hide) best-effort | Deferred — follow-up |
| Version bump 0.9.0 | Done |

**Out of band for 0.9.0:** Play Store / App Store listing, Signet graduate (OV/notarize), auto-update, share-sheet import.

**Out of band for 0.9.0:** Play Store / App Store listing, Signet graduate (OV/notarize), auto-update, share-sheet import.

Next after 0.9.0: **Phase E** friction & hygiene (below), then **Phase D** folder sync / store signing.

### Post-0.9.0 — Phase E overview

Umbrella: `specs/backend/post-0.9.0-friction-hygiene-umbrella.md`

| Version | Theme | Status |
|---------|--------|--------|
| v0.10 | Generate, quick-add, soft-delete | Done |
| v0.11 | Password health + optional breach pack | Done |
| v0.12 | Desktop autotype + URL/app match | Done |
| v0.13 | Attachments, snapshots, structured notes | Done — v0.13.0 |

### v0.10.0 — Generate, capture & soft-delete — done

Design: `specs/backend/v0.10.0-generate-capture-design.md`

| Item | Status |
|------|--------|
| Password generator (presets + apply-to-editor; session-only history; scrub) | Done |
| Quick-add from clipboard (password / otpauth / labeled paste → draft only) | Done |
| Soft-delete + Recycle bin + retain-N-days purge (`vault-core` owner) | Done |
| Frontend-spec / threat-model touch + version bump 0.10.0 | Done |

### v0.11.0 — Password health — done

Design: `specs/backend/v0.11.0-password-health-design.md`

| Item | Status |
|------|--------|
| Local health report (reuse, short/weak; workspace-scoped) | Done |
| Optional breach pack (offline denylist + gated HIBP k-anonymity; default off) | Done |
| Version bump 0.11.0 | Done (shipped with v0.12.0 tag) |

### v0.12.0 — Desktop fill & match — done

Design: `specs/backend/v0.12.0-desktop-fill-match-design.md`

| Item | Status |
|------|--------|
| Threat-model + design for autotype / window match | Done |
| Autotype into focused window (confirm; Windows first) | Done |
| Opt-in URL / app-title entry suggestions | Done |
| Version bump 0.12.0 | Done |

Next: **v0.14** folder sync — design `specs/backend/v0.14.0-folder-sync-design.md`. Post-0.13 UX remediation is on `main` ahead of the next release tag.

### v0.13.0 — Vault richness — done

Design: `specs/backend/v0.13.0-vault-richness-design.md`

| Item | Status |
|------|--------|
| Encrypted attachments (size cap; trash-aligned) | Done |
| Dated encrypted snapshots + one-click restore | Done |
| Structured notes (markdown; searchable) | Done |
| Version bump 0.13.0 | Done |

### v0.14.0 — Optional folder sync — design

Design: `specs/backend/v0.14.0-folder-sync-design.md`

| Item | Status |
|------|--------|
| User data-dir / Syncthing as sync root (reuse `set_data_dir`) | Design |
| External `vault.km` change → lock / refuse persist (LWW blob) | Design |
| Docs: attachments travel with data dir; no Clavis cloud | Design |

Next: implement atomic slices 2–5 from the design, then tag 0.14.0.
