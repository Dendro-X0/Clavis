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
| P1 | Autofill / “copy user then pass” timed sequence | Reduce dwell time of secrets on clipboard |
| P1 | Optional PIN / biometric over keyring (desktop + mobile) | Ease of unlock without weakening master password |
| P2 | Secure field reveal (hold-to-show), screen capture flags where OS allows | Shoulder-surfing / casual capture |
| P2 | Integrity: signed vault metadata / tamper detection UX | Clear “vault file changed” messaging |
| P3 | Audit logging (local, optional) | Power users / shared machines |
| Later | Hardware key / passkey unlock of vault key wrap | Advanced users; keep master password recovery |

**Non-goals (keep explicit):** no Clavis-operated cloud; no “sync password to our servers.”

---

## Ease-of-use track

| Priority | Item | Why |
|----------|------|-----|
| P0 | Onboarding: create vault → import → first copy | Empty-state education |
| P0 | Search + keyboard shortcuts (lock, new, search focus) | Done — global search + Ctrl/Cmd+K palette |
| P1 | Autotype / fill helper (desktop) where safe | Faster logins than copy-paste |
| P1 | TOTP / otpauth fields | Common password-manager expectation |
| P1 | Favicons / site icons (optional, offline-safe) | v0.3.0 — lettermark + optional cache |
| P1 | Duplicate workspace merge / cleanup | Users already hit duplicate names |
| P1 | Workspace sidebar pins + clipboard clear toast | v0.3.0 |
| P2 | Password health (length, reuse warnings — local only) | Guidance without phoning home |
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

### Phase D — Interop & trust

- Import from Bitwarden / KeePass / browser CSV (documented mapping)
- Optional user-folder sync of `vault.km` (conflict = last-write or explicit merge)
- Store signing / notarization when project is ready (not blocking OSS users)

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

Next after 0.6.0: **Phase D** interop & trust (imports, optional file sync, store signing when ready).
