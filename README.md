# Clavis (Keys Manager)

Local-first portable credential vault. Tauri v2 + Rust core + Next.js UI.  
**OSS · self-signed / unsigned releases** (see below). Current version: **0.4.0**.

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
| `pnpm --filter @clavis/mobile android:init` | Once: generate Android Studio project |
| `pnpm --filter @clavis/mobile android:dev` | Mobile preview on emulator/device |
| `pnpm build` | Release desktop build |
| `pnpm build:web` | Static export of the web UI |
| `pnpm test:vault` | Rust `vault-core` tests |
| `node scripts/checksum-release.mjs <path>` | SHA-256 lines for release artifacts |

Light/dark theme toggle lives in the custom titlebar and Settings. Theme preference is stored in `data/config.json`.

Credential imports create a **workspace** (named from the file). If that name already exists, Clavis asks whether to **replace** it. Workspaces live in the **dashboard** strip (not the sidebar). Toggle **list / grid** for entries; name and categorize items in the editor.

**Search & shortcuts** (Windows / Linux / macOS): toolbar search matches all workspaces when you type a query; `Ctrl/Cmd+K` opens the command palette; `/` focuses toolbar search; `Ctrl/Cmd+N` new entry; `Ctrl/Cmd+L` lock; `Ctrl/Cmd+,` settings; `Esc` closes palette/editor.

## Installing self-signed builds

GitHub Releases may include installers that are **not** signed by Microsoft/Apple store certificates.

| OS | What you may see | What to do |
|----|------------------|------------|
| Windows | SmartScreen “Windows protected your PC” | More info → **Run anyway** (after verifying the SHA-256 on the release) |
| macOS | “App can’t be opened because it is from an unidentified developer” | System Settings → Privacy & Security → **Open Anyway** |
| Linux | Depends on package | Prefer checksum match + build from the release tag |

**Always verify checksums** against `SHA256SUMS.txt` (or hashes listed on the release) before running a downloaded binary. Prefer building from source if you do not trust a binary:

```bash
git checkout v0.4.0   # or the release tag
pnpm install
pnpm build
```

Maintainer release steps: [docs/release-checklist.md](docs/release-checklist.md).

## Layout

```
apps/web          @clavis/web     Next.js static UI
apps/desktop      @clavis/desktop Desktop Tauri shell
apps/mobile       @clavis/mobile  Mobile preview shell (Android/iOS)
crates/vault-core                 Encrypted vault library
crates/clavis-shell               Shared Tauri IPC
docs/                             Start-here, threat model, roadmap, platforms
scripts/                          Release checksum helper
```

## Data location

Desktop: `{executable_directory}/data/` (portable) or a custom folder from Settings. Mobile preview: OS app sandbox. Encrypted file: `vault.km`.

See [docs/START-HERE.md](docs/START-HERE.md). Platforms & keyring: [docs/platforms.md](docs/platforms.md). Future work: [docs/roadmap.md](docs/roadmap.md).
