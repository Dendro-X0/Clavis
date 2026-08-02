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
   - Search (titles, users, URLs, categories/tags)
   - Optional category chip filter (from entry tags in current workspace)
   - Layout toggle: **list** (default, current) | **grid** (cards)
   - Replace | New entry
3. **Entry surface**
   - List or grid of entries for active workspace
   - **Pagination**: page size 10 / 25 / 50 / 100 (user-selectable); footer with prev/next and range
   - Editor panel when creating/editing
4. Settings replaces main when nav=settings

### Dialogs

All destructive or naming prompts use custom Radix dialogs via an app-level host (`appConfirm` / `appPrompt`). No native browser pop-ups.

### Entries: name & categorize

| Field (UI) | Model | Notes |
|------------|--------|------|
| Name | `title` | Required display name |
| Type | `entryType` | login / note / api / custom (primary category) |
| Categories | `tags` | Freeform labels, comma-separated in editor; shown on list/grid |

### Layout modes

| Mode | Presentation |
|------|----------------|
| `list` | Compact rows: name, type, username/url, category chips, User/Pass |
| `grid` | Responsive card grid: name, type, username/url, categories, copy actions |

Preference persists in `AppSettings.entryLayout` (`"list" | "grid"`).
`AppSettings.pageSize`: `10 | 25 | 50 | 100` (default `25`).

## Window chrome

- `decorations: false`
- Custom titlebar ~40px, `data-tauri-drag-region`
- Controls: minimize, maximize/toggle, close via `@tauri-apps/api/window`

## Persistence

`data/config.json`:

- `theme`: `"light" | "dark" | "system"`
- `entryLayout`: `"list" | "grid"` (default `list`)
- `pageSize`: `10 | 25 | 50 | 100` (default `25`)
- auto-lock / clipboard / biometric as before
