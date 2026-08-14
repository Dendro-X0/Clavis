# Clavis — features, design, and purpose

**Clavis** (Keys Manager) is a local-first credential vault for people who want their passwords, tokens, and notes under their own control — on disk, on a USB stick, or in a folder they sync themselves. There is no Clavis cloud account, no vendor lock-in, and no network requirement to use the app day to day.

Current version: see [README](../README.md).

---

## Purpose

| Principle | What it means in practice |
|-----------|---------------------------|
| **Local-first** | Secrets live in an encrypted `vault.km` file on your machine (or portable kit). Unlock with a master password; optional OS keyring for convenience only. |
| **Portable** | Desktop defaults to `{executable}/data/` so you can copy the whole install folder to USB and run elsewhere. |
| **Offline-first** | Outbound network is off by default. Favicons, breach checks, and similar features require explicit opt-in. |
| **Transparent OSS** | Crypto and vault logic live in Rust (`vault-core`). Releases are self-signed; verify checksums or build from a tag. |
| **Tool, not portal** | The UI is a dense dashboard — find, copy, fill, import — not a marketing site. |

**Who it is for:** solo developers, power users, and anyone managing logins across projects who prefers a file they own over a hosted password manager.

**Who it is not for (today):** teams needing shared vaults with ACLs, browser extension autofill everywhere, or a managed cloud sync service from the vendor.

---

## Design

Clavis follows a **dual-theme dashboard shell** inspired by modern CRM / Linear-style tools: narrow sidebar for vault filters, wide main area for workspaces and entries, custom titlebar (no OS chrome clutter).

### Visual system

- **Themes:** light, dark, or follow system (`next-themes`).
- **Skins (color schemes):** persisted per vault install.
  - **Seafoam** (default) — teal accent on cool slate.
  - **Graphite** — amber accent on charcoal / steel gray.
- **Density:** compact rows, hairline dividers, left-accent selection bars — not card stacks or decorative gradients.
- **Accessibility:** skip link to main content, `aria-live` feedback, keyboard-first navigation, `prefers-reduced-motion` respected.

Full token tables and layout rules: [frontend-spec.md](frontend-spec.md).

### App shell (unlocked)

```
┌ Titlebar — theme, window controls ─────────────────────────────┐
├ Sidebar ──────┬ Main dashboard ────────────────────────────────┤
│ Search (⌘K)   │ Workspace strip → toolbar → entry list/grid    │
│ All / Logins  │ Editor panel when creating or editing          │
│ Notes / …     │                                                │
│ Settings      │                                                │
│ Lock          │                                                │
└───────────────┴────────────────────────────────────────────────┘
```

**Workspaces** live in the main dashboard strip (cards/chips), not in the sidebar. Pinned workspaces can appear under Vault in the sidebar for quick switching.

**Settings** replaces the main pane with a two-column layout: categorized section nav + content. On compact widths, sections collapse to a dropdown.

---

## Feature overview

### Vault and entries

- **Master password** encrypts the vault with Argon2id + AES-256-GCM ([vault-format.md](vault-format.md)).
- **Entry types:** Login, Note, API / token, Custom — each with appropriate fields (username, password, URL, TOTP, custom fields, markdown notes, attachments).
- **Workspaces:** Logical containers (often one per imported file). Rename, delete, merge; import creates or replaces by name.
- **Soft delete:** Entries move to a **Recycle bin** with configurable retain days before auto-purge.
- **Snapshots:** Dated encrypted copies of `vault.km` for local rollback.
- **Attachments:** Small encrypted sidecars per entry (export is still vault-only by design).

### Find and act quickly

- **Toolbar search** filters the active workspace when empty; searches **all workspaces** when you type a query (title, username, URL, tags, workspace name).
- **Command palette** (`Mod+K`, rebindable): jump to entries, workspaces, vault views (All / Logins / …), settings sections, and actions (new entry, lock, layout toggle, etc.). Duplicate results are collapsed; shortcut hints reflect your keymap.
- **List focus:** `↑`/`↓` or `j`/`k` to move focus; `Enter` to open; `c` / `u` / `p` / `o` to copy login sequence, username, password, or TOTP.
- **Shortcuts help:** `?` opens an overlay; **Settings → Keyboard** remaps bindings with conflict detection.

### Copy and fill

- **Copy login** pastes username, then password (and TOTP when set) with clipboard auto-clear (configurable seconds).
- **Desktop fill (Windows):** opt-in autotype into the focused window after confirmation showing the target title.
- **Password generator:** Strong / Passphrase / PIN presets; apply to editor; session-only history wiped on lock.

### Import and export

- Drag-and-drop or file picker for credential imports (CSV and common export formats).
- Imports create a **workspace** named from the file; duplicate names prompt replace vs cancel.
- Encrypted backup export/import with KDF transparency and optional upgrade to stronger defaults.

### Settings (high level)

| Section | Highlights |
|---------|------------|
| Appearance | Theme, skin, list/grid default, page size |
| Keyboard | View and remap shortcuts |
| Lock & clipboard | Idle auto-lock, lock on hide, clipboard clear timing |
| Convenience unlock | OS keyring / biometrics (off by default) |
| Master password | Change vault encryption password |
| Data folder | Portable path vs custom synced directory |
| Snapshots | Create, restore, retention |
| Recycle bin | Retain deleted entries N days |
| Network | Offline gate; favicons; optional HIBP breach check |
| Desktop fill | Autotype and title-match suggestions |
| Workspaces | Rename, delete, merge |
| Import & export | Backups, CSV, KDF upgrade |

### Security and hygiene

- Auto-lock on idle and when the window is hidden (configurable).
- Master password and derived keys zeroized on lock; sensitive UI cleared.
- Optional vault file fingerprint warning if `vault.km` changed on disk since last unlock.
- Password health report (local reuse/weak/short); optional Have I Been Pwned k-anonymity check when network is enabled.
- Threat assumptions: [threat-model.md](threat-model.md).

### Platforms

| Surface | Status |
|---------|--------|
| Windows / macOS / Linux desktop | Primary |
| Android / iOS (Tauri mobile preview) | Phase C — sandbox data dir, compact UI |
| Web UI only (`pnpm dev:web`) | Dev preview without vault IPC |

Details: [platforms.md](platforms.md).

---

## Demonstrations

Animated walkthroughs live in [demos/](demos/). GitHub renders them on the [project README](../README.md).

| GIF | Shows |
|-----|--------|
| [search.gif](demos/search.gif) | Command palette: global search, settings sections, vault navigation |
| [import-files.gif](demos/import-files.gif) | Drag-and-drop import and workspace creation |
| [appearance-settings.gif](demos/appearance-settings.gif) | Theme, skins, and layout preferences |
| [keyboard.gif](demos/keyboard.gif) | Shortcuts help, list focus, keyboard remapping |
| [delete-recycle-bin.gif](demos/delete-recycle-bin.gif) | Soft delete, recycle bin, restore or purge |

---

## Related docs

| Doc | Contents |
|-----|----------|
| [START-HERE.md](START-HERE.md) | Repo layout and dev loop |
| [architecture.md](architecture.md) | Stack diagram and locking summary |
| [frontend-spec.md](frontend-spec.md) | UI tokens, shell, keyboard contract |
| [roadmap.md](roadmap.md) | Version history and planned work |
| [threat-model.md](threat-model.md) | Assets, boundaries, mitigations |
| [platforms.md](platforms.md) | OS matrix, data dirs, keyring |
| [release-checklist.md](release-checklist.md) | Maintainer release steps |
