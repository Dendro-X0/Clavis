# Frontend Spec — Clavis UI Redesign

## Meta

- **Product:** Clavis (Keys Manager)
- **Audience:** Solo users managing local credentials
- **Reference tier:** Obscur dual-theme + Aperio dashboard shell
- **Stack:** Next.js static export, Tailwind 4, light shadcn-style primitives, lucide-react, next-themes, Tauri v2
- **Spec status:** approved (implementation target)
- **API dependency:** Tauri vault/workspace commands + `AppSettings.theme` + `AppSettings.entryLayout`

## Visual direction

- Theme: dual (light / dark / system)
- Accent: seafoam teal on cool slate
- Surface rule: sidebar and main share shell tier; differentiate with hairline border
- Density: CRM/Linear (tool, not marketing landing)
- **NOT:** purple glow, cream+terracotta, newspaper columns, card-in-card stacks, OS titlebar chrome

## Design tokens

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#e8eef2` | `#0f1c1c` |
| `--foreground` | `#1a2b2e` | `#e7f2f0` |
| `--card` | `rgba(255,255,255,0.55)` | `rgba(28,51,51,0.45)` |
| `--muted` | `#5c7278` | `#8eaeaa` |
| `--border` | `rgba(26,43,46,0.12)` | `rgba(231,242,240,0.12)` |
| `--primary` | `#2a8f83` | `#3db8a8` |
| `--sidebar` | same as shell wash | same as shell wash |
| `--titlebar` | transparent over gradient | transparent over gradient |
| `--danger` | `#c45b52` | `#d9776c` |

Shell atmosphere: layered radial + linear gradients (teal wash top-left).

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
   - Editor panel when creating/editing
4. Settings replaces main when nav=settings
5. **Command palette** (`Ctrl/Cmd+K`): search entries globally + actions (New, Settings, Lock, Focus search, Toggle layout). `/` focuses toolbar search. `Ctrl/Cmd+,` opens Settings. Esc closes palette then editor.
6. **v0.3.0 palette**: switch workspace rows; per-entry Copy login / User / Pass actions.
7. **Sidebar workspace pins**: pinned IDs under Vault; pin/unpin from workspace cards; active workspace always listed if not pinned.
8. **Clipboard toast**: countdown while auto-clear is pending after copy.
9. **Entry icons**: lettermark from host/title; optional favicon fetch when `fetchFavicons` is on.
10. **v0.4.0 compact gestures**: swipe right → copy login; swipe left → open entry; long-press → Copy all / User / Pass menu. Granular copy buttons hidden on compact; desktop buttons unchanged.
11. **Biometric / convenience unlock**: **off by default**. Enable only in Settings (`biometricUnlock` + store master password in OS keyring). Gate never opts the user in. When enabled and OS biometrics are available (mobile), primary “Unlock with biometrics”; otherwise desktop may silent-try keyring. Master password always available.

### Dialogs

All destructive or naming prompts use custom Radix dialogs via an app-level host (`appConfirm` / `appPrompt`). No native browser pop-ups. Command palette uses the same Dialog primitive.

### Entries: name & categorize

| Field (UI) | Model | Notes |
|------------|--------|------|
| Name | `title` | Required display name |
| Type | `entryType` | login / note / api / custom (primary category) |
| Categories | `tags` | Freeform labels, comma-separated in editor; shown on list/grid |

### Layout modes

| Mode | Presentation |
|------|----------------|
| `list` | Compact rows: icon, name, type, username/url, category chips, User/Pass |
| `grid` | Responsive card grid: icon, name, type, username/url, categories, copy actions |

Preference persists in `AppSettings.entryLayout` (`"list" | "grid"`).
`AppSettings.pageSize`: `10 | 25 | 50 | 100` (default `25`).

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
- `entryLayout`: `"list" | "grid"` (default `list`)
- `pageSize`: `10 | 25 | 50 | 100` (default `25`)
- `pinnedWorkspaceIds`: `string[]` (default `[]`)
- `fetchFavicons`: `boolean` (default `false`)
- `biometricUnlock`: `boolean` (default `false`) — convenience unlock via OS keyring; configure only in Settings
- auto-lock / clipboard as before
