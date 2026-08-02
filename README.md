# Clavis (Keys Manager)

Local-first portable credential vault. Tauri v2 + Rust core + Next.js UI.

## Prerequisites

- [pnpm](https://pnpm.io) 9+
- Rust (stable) + [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
pnpm install
```

## Commands (from repo root)

| Command | What it does |
|---------|----------------|
| `pnpm dev` | Desktop app (Tauri + web UI) |
| `pnpm dev:web` | Web UI only (browser, no vault IPC) |
| `pnpm dev:desktop` | Same as `pnpm dev` |
| `pnpm build` | Release desktop build |
| `pnpm build:web` | Static export of the web UI |
| `pnpm test:vault` | Rust `vault-core` tests |

## Layout

```
apps/web          @clavis/web     Next.js static UI
apps/desktop      @clavis/desktop Tauri shell (src-tauri/)
crates/vault-core                 Encrypted vault library
docs/                             Start-here, threat model, format
```

## Data location

All vault state lives under `{executable_directory}/data/` (portable). Encrypted file: `data/vault.km`.

See [docs/START-HERE.md](docs/START-HERE.md).
