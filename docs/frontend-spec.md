# Frontend Spec — Clavis UI Redesign

Product overview and feature tour: [features.md](features.md). Demo GIFs: [demos/](demos/) (embedded in [README](../README.md)).

## Meta

- **Product:** Clavis (Keys Manager)
- **Audience:** Solo users managing local credentials
- **Reference tier:** Obscur dual-theme + Aperio dashboard shell
- **Stack:** Next.js 16 static export, Tailwind 4, light shadcn-style primitives, lucide-react, next-themes, Tauri v2
- **Spec status:** approved (implementation target)
- **API dependency:** Tauri vault/workspace commands + `AppSettings.theme` + `AppSettings.skin` + `AppSettings.entryLayout`

## Visual direction

- Theme: dual (light / dark / system) via `next-themes`
- **Skins** (color schemes): each skin defines a full light + dark token set; persisted as `AppSettings.skin`
  - **Seafoam** (default) — teal accent on cool slate
  - **Graphite** — amber accent on cool charcoal / steel gray
- Surface rule: sidebar and main share shell tier; differentiate with hairline border
- Density: CRM/Linear (tool, not marketing landing)
- **NOT:** purple glow, cream+terracotta, newspaper columns, card-in-card stacks, OS titlebar chrome

## Design tokens

Tokens live as CSS variables on `html[data-skin="…"]` (and `.dark`). Components use `var(--primary)` etc. — never hard-code a skin accent.

### Seafoam (default)

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#e8eef2` | `#0f1c1c` |
| `--foreground` | `#1a2b2e` | `#e7f2f0` |
| `--primary` | `#2a8f83` | `#3db8a8` |
| `--danger` | `#c45b52` | `#d9776c` |

### Graphite

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#eceef2` | `#12141a` |
| `--foreground` | `#1a1d24` | `#e9ebf0` |
| `--primary` | `#9a6b2f` | `#d4a054` |
| `--danger` | `#c45b52` | `#e08a7a` |

Shell atmosphere: layered radial + linear gradients per skin (accent wash top-left).

## App shell

- Always: `Titlebar` (drag + theme + window controls)
- Locked/missing: full-bleed `Gate`
- Unlocked: `Sidebar` (vault filters only) + `Main` dashboard

### Sidebar (narrow)

```
VAULT
- all / login / note / api / custom — type filters for active workspace

SYSTEM
- settings
- lock
```

Workspaces are **not** in the sidebar.

### Main dashboard

1. **Workspace cards** (dashboard area)
   - Card grid/row for each workspace (name, entry count, source hint); selected card highlighted
   - Per-card actions: select (click), rename, delete — **in-app dialogs**
   - Dashed “New workspace” card to create
   - Import file → new workspace (name = file stem); same-name → replace confirm dialog
2. **Toolbar**
   - Search **all workspaces** when query is non-empty (titles, users, URLs, categories/tags, workspace name); empty query = active workspace only
   - Foreign-workspace hits show a workspace label; selecting switches workspace and opens the entry
   - Optional category chip filter
   - Layout toggle: **list** (default) | **grid**
   - Replace | New entry
3. **Entry surface**
   - List or grid of entries (active workspace, or global search results)
   - **Pagination**: page size 10 / 25 / 50 / 100 (user-selectable); footer with prev/next and range
   - Selecting an existing entry opens a **View** panel (grouped credentials / notes / fields with per-field copy). **Edit** is a toggle; new entries open in Edit.
   - **Large dialog**: Maximize on the panel opens a centered `ModalShell` (`~72rem` × `~92vh`) with the same View/Edit surface and a two-column layout (credentials left, notes/attachments right). Dock returns to the side panel. Compact (`<768px`) opens the large dialog by default. Esc docks on desktop; Esc closes the entry on compact. Close still discards the panel.
4. Settings replaces main when nav=settings — **two-pane layout**: categorized sidebar (search + section nav with hairline category dividers) + section content; compact uses section dropdown. Nav width is fluid (`clamp`); content column scales up to ~52rem on ultra-wide. Minimal field rows with hairline dividers; nav uses left accent bar (matches main sidebar).
5. **Command palette** (`Mod+K`, user-rebindable): search entries, workspaces, vault nav, settings sections, and actions (New, Lock, Focus search, Toggle layout). Shortcut hints and sidebar badge reflect `keybindingOverrides`. `/` focuses toolbar search. Esc closes palette then editor. **Mod** = ⌘ on macOS, Ctrl on Windows/Linux.
6. **v0.3.0 palette**: switch workspace rows; per-entry Copy login / User / Pass actions.
6b. **Keyboard package**: central `keybindings` registry; list focus nav; shortcuts help (`?`); Settings → Keyboard to view/rebind; confirm Enter/Esc; Gate Enter submits unlock.
7. **Sidebar workspace pins**: pinned IDs under Vault; pin/unpin from workspace cards; active workspace always listed if not pinned.
8. **Clipboard toast**: countdown while auto-clear is pending after copy.
9. **Entry icons**: lettermark from host/title; optional favicon fetch when `fetchFavicons` is on.
10. **v0.4.0 compact gestures**: swipe right → copy login; swipe left → open entry; long-press → Copy all / User / Pass menu. Granular copy buttons hidden on compact; desktop buttons unchanged.
11. **Biometric / convenience unlock**: **off by default**. Enable only in Settings (`biometricUnlock` + store master password in OS keyring). Gate never opts the user in. When enabled and OS biometrics are available (mobile), primary “Unlock with biometrics”; otherwise desktop may silent-try keyring. Master password always available.
12. **Sensitive UI lifecycle (v0.5.0)**: clear Gate/settings password fields after success or IPC error; discard entry editor and cancel pending login-copy timers on lock; list copy paths keep secrets ephemeral (not in React list state).
13. **Auto-lock Settings**: idle seconds + **Lock when window is hidden** (`lockOnHide`, default on). Desktop **Keep running in the tray** (`runInBackground`, default on): Close hides to the system tray; Quit from the tray menu exits.
14. **Encrypted backup KDF (v0.6.0)**: Settings Import/export shows active vault KDF (Argon2id params + AES-256-GCM). Export confirms with those params. Import peeks the file header (no password), warns if weaker than app defaults, and offers **Upgrade KDF to defaults** (password prompt) after import when the live vault is still weak.
15. **Offline-first portable (v0.7.0)**: Settings portable kit; **Make portable** copies vault into `{exe}/data/`; `allowNetwork` (default off) gates outbound HTTP; hold-to-reveal password fields; unlock may warn if `vault.km` SHA-256 changed since last session.
16. **TOTP (v0.8.0)**: Optional `otpSecret` on entries; live code + Copy code; Copy login sequences user → password → TOTP when set. CSV imports map Bitwarden/KeePass `totp` columns.
17. **Generate / capture / trash (v0.10)**: Password generator presets (Strong / Passphrase / PIN) with apply-to-editor and session-only history (wiped on lock). “New from clipboard” opens an editor draft only (otpauth / labeled / password-like). Soft-delete → Recycle bin; restore or purge; retain days in Settings.
18. **Password health (v0.11)**: Local report (reuse / short / weak / common denylist); trash excluded. Optional HIBP k-anonymity behind `allowNetwork` + `checkBreaches` (one-shot from Health panel).
19. **Desktop fill (v0.12)**: Opt-in Windows autotype (confirm shows foreground title; SendInput). Optional title-based suggestions. Defaults off.
20. **Vault richness (v0.13)**: Settings snapshots (create / restore / retain); entry notes plain|markdown + preview; encrypted attachments (≤256 KiB, 5/entry) with purge-aligned sidecars. Encrypted export is still `vault.km` only.
21. **UX remediation (post-0.13)**: Calm unlocked home (compact workspace strip); simplified empty state (1 primary + secondary actions); hardened `ModalShell` (focus trap); success toast vs error banner with `aria-live`; a11y labels + `prefers-reduced-motion`; shared `btn-*` kit; list/grid `content-visibility` for large vaults; optional hash URL state for nav/search/tag/page/settings section; skip link to main; grid/list open targets are real `<button>`s (no `div[role=button]`); sidebar icon actions have `aria-label`.
22. **Entry view + large dialog**: View/Edit toggle on existing entries; expand to a large modal for comfortable reading of notes and selective copy.

### Dialogs

All destructive or naming prompts use custom Radix dialogs via an app-level host (`appConfirm` / `appPrompt`). No native browser pop-ups. Command palette uses the same Dialog primitive. Feature modals (health / generator / trash) use `ModalShell` with focus trap, Escape, and backdrop dismiss.

### UX remediation — unlocked home

| Surface | Target |
|---------|--------|
| Workspaces | Horizontal chip strip (active + count); pin/rename/delete as compact icon actions — not tall cards |
| Empty workspace | One primary **New entry**; secondary **Import** / **From clipboard**; tertiary text links for paste→workspace and Replace |
| Feedback | Errors → banner `role="alert"`; successes → brief status toast (`aria-live="polite"`) |
| Search | Visible label or `aria-label` on `#vault-search` |
| Controls | Shared CSS kit: `btn-primary` / `btn-ghost` / `btn-danger` (+ `-sm` / `btn-icon`) |
| Large lists | `entry-row-virtual` / `entry-card-virtual` (`content-visibility: auto`) — no virtualizer dep yet |
| Deep links | Hash query (`#nav=…&q=…&tag=…&page=…&section=…`); no secrets; cleared toward defaults on lock |
| Keyboard | Skip link → `#main-content`; see **Keyboard** below |

### Keyboard

Central module: `apps/web/src/lib/keybindings.ts`. Chords use `mod` for the platform primary modifier (⌘ macOS / Ctrl Win+Linux).

**When chords apply:** vault unlocked; not typing in `input`/`textarea`/`select`/contenteditable (except Escape and Mod chords that always work); dialogs/modals take precedence over list/global shortcuts.

| Action ID | Default | Group |
|-----------|---------|-------|
| `palette` | `mod+k` | Global |
| `search` | `/` | Global |
| `newEntry` | `mod+n` | Global |
| `lock` | `mod+l` | Global |
| `settings` | `mod+,` | Global |
| `shortcutsHelp` | `?` | Global |
| `listUp` | `arrowup` (+ alias `k`) | List |
| `listDown` | `arrowdown` (+ alias `j`) | List |
| `listOpen` | `enter` | List |
| `copyLogin` | `c` | List |
| `copyUser` | `u` | List |
| `copyPass` | `p` | List |
| `copyOtp` | `o` | List |

**List focus:** `listFocusIndex` over current page of entries; ring distinct from editor selection (`data-list-focus`). Reset on page/filter/workspace change. Skip when Settings, empty list, or dialogs open.

**Dialogs:** `appConfirm` — Enter confirms, Esc cancels; autofocus primary button. `appPrompt` — Enter submits form, Esc cancels. Gate unlock/create — form submit on Enter.

**Settings → Keyboard (General):** table of action + platform-formatted chord; Change (capture) with conflict check; Reset all. Overrides persist as `AppSettings.keybindingOverrides` (`Record<actionId, chord>`).

**Shortcuts help:** `?` or Settings link opens overlay grouped Global / List / Dialogs with resolved (override-aware) labels.

### Entries: name & categorize

| Field (UI) | Model | Notes |
|------------|--------|------|
| Name | `title` | Required display name |
| Type | `entryType` | login / note / api / custom (primary category) |
| Username | `username` | Primary login id — email **or** username (same field) |
| TOTP seed | `otpSecret` | Optional Base32 / otpauth URI; codes are SHA-1 · 6 digits · 30s |
| Categories | `tags` | Freeform labels, comma-separated in editor; shown on list/grid |
| Notes | `notes` + `notesFormat` | Plain or markdown; searchable when unlocked; optional preview |
| Attachments | sidecars + meta | Max 256 KiB × 5; encrypted under data/attachments |
| Custom fields | `customFields` | Extra labeled values (e.g. Email, Phone); add/remove in editor; searchable |

**Custom fields (v0.6.1):** Below Categories, a **Custom fields** section lists `{ label, value }` rows with copy and remove. **Add field** appends a blank row; quick actions prefill label **Email** or **Phone**. Values persist via existing upsert IPC; cleared on lock scrub like other secrets.

### Layout modes

| Mode | Presentation |
|------|----------------|
| `list` | Compact rows: icon, name, type, username/url, category chips, User/Pass |
| `grid` | Responsive card grid: icon, name, type, username/url, categories, copy actions |

Preference persists in `AppSettings.entryLayout` (`"list" | "grid"`).
`AppSettings.pageSize`: `10 | 25 | 50 | 100` (default `25`).

**Page size control:** Row of equal-width options (`10` / `25` / `50` / `100`), not a dropdown — used in Settings → Appearance and the vault list footer. `role="radiogroup"` with `aria-checked` on the selected option; wraps on narrow widths; tap targets use `.touch-target` under `data-compact`.

## Window chrome

- `decorations: false` (desktop)
- Custom titlebar ~40px, `data-tauri-drag-region`
- Controls: minimize, maximize/restore (distinct icons), close via `@tauri-apps/api/window`

## Compact / mobile surface (Phase C)

Activate when viewport `< 768px` (CSS + `matchMedia`) — same web bundle on desktop narrow windows and Tauri mobile WebView.

| Element | Compact behavior |
|---------|------------------|
| Window controls | Hidden |
| Titlebar subtitle (“Local vault”) | Hidden; brand + theme only |
| Sidebar | Collapsed by default; filters remain reachable |
| Primary actions | Min tap height **44px**; desktop keeps copy buttons |
| Entry list | Swipe right = copy login; swipe left = open; long-press = copy menu; hide granular Copy/User/Pass |
| Entry layout | Prefer **list**; grid still available |
| Padding | Tighter main padding (`p-3`) |
| Desktop-only settings | Hide “Change data folder” on compact (mobile uses app sandbox) |
| Unlock | Biometrics primary when enabled + available; password fallback |

Shell root may set `data-compact="true"` for CSS hooks (`.touch-target`, hide `[data-desktop-only]`).

## Persistence

`data/config.json`:

- `theme`: `"light" | "dark" | "system"`
- `skin`: `"seafoam" | "graphite"` (default `seafoam`) — color scheme; independent of light/dark
- `entryLayout`: `"list" | "grid"` (default `list`)
- `pageSize`: `10 | 25 | 50 | 100` (default `25`)
- `pinnedWorkspaceIds`: `string[]` (default `[]`)
- `fetchFavicons`: `boolean` (default `false`)
- `allowNetwork`: `boolean` (default `false`) — master outbound HTTP gate; favicon fetch requires both this and `fetchFavicons`
- `lastVaultSha256`: optional hex string — fingerprint of encrypted `vault.km` (integrity signal, not a signature)
- `biometricUnlock`: `boolean` (default `false`) — convenience unlock via OS keyring; configure only in Settings
- `autoLockSeconds`: number (default `300`) — idle lock from app input; `0` = never (idle only; lock-on-hide still applies)
- `lockOnHide`: `boolean` (default `true`) — lock when document is hidden (tab / minimize / background / tray)
- `runInBackground`: `boolean` (default `true`, desktop) — Close hides to tray instead of quitting
- `clipboardClearSeconds`: number (default `15` for new installs)
- `trashRetainDays`: number (default `30`) — soft-deleted entries older than this are purged on unlock
- `checkBreaches`: `boolean` (default `false`) — opt-in HIBP; requires `allowNetwork`
- `autotypeEnabled`: `boolean` (default `false`) — Windows SendInput after confirm
- `suggestFromForeground`: `boolean` (default `false`) — title heuristic suggestions
- `autotypeKeyDelayMs`: number (default `25`)
- `keybindingOverrides`: `Record<string, string>` (default `{}`) — actionId → chord overrides; empty = defaults
