# Clavis design system

## Brand

- **Name:** Clavis
- **Accent:** seafoam / teal (`#2a8f83` light, `#3db8a8` dark)
- **Type:** Fraunces (display), Sora (body)

## Atmosphere

Subtle multi-stop gradients on the shell — never flat single-color fills for the app chrome. Light and dark share the same gradient structure with different stops.

## Shell rules

1. Titlebar, sidebar, and main sit on one shell background.
2. Active nav: left accent bar + soft primary tint.
3. Cards/panels: translucent `--card` + `--border` hairline — used only for interactive groupings (entry list, editor, gate form).
4. Custom scrollbars: 8px, rounded thumb using muted/primary.

## Components

Prefer small local primitives (`Button`, `Input`, `ScrollArea`) over heavy card dashboards. Motion: rise-in on panels, soft pulse on copy.
