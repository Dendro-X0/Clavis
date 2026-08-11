# Clavis design system

## Brand

- **Name:** Clavis
- **Mark:** Polygonal shield + geometric lock (`ClavisMark`). Fill `--primary`, details `--primary-fg` — reads as safety; adapts to skins and light/dark.
- **Wordmark:** Fraunces via `ClavisLogo` (titlebar + Gate)
- **Skins:** Seafoam (default teal) · Graphite (amber on steel)
- **Type:** Fraunces (display), Sora (body)

## Skins

| Skin | Light accent | Dark accent | Atmosphere |
|------|--------------|-------------|------------|
| `seafoam` | `#2a8f83` | `#3db8a8` | Cool teal wash |
| `graphite` | `#9a6b2f` | `#d4a054` | Cool charcoal + amber |

Persisted as `AppSettings.skin`. Light/dark/system remains `AppSettings.theme` (titlebar toggle). Apply via `html[data-skin="…"]` + `.dark`.

## Atmosphere

Subtle multi-stop gradients on the shell — never flat single-color fills for the app chrome. Light and dark share the same gradient structure with different stops per skin.

## Shell rules

1. Titlebar, sidebar, and main sit on one shell background.
2. Active nav: left accent bar + soft primary tint.
3. Cards/panels: translucent `--card` + `--border` hairline — used only for interactive groupings (entry list, editor, gate form).
4. Custom scrollbars: 8px, rounded thumb using muted/primary.

## Components

Prefer small local primitives (`Button`, `Input`, `ScrollArea`) over heavy card dashboards. Motion: rise-in on panels, soft pulse on copy.
