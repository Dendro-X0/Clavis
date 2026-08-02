# Release checklist — Clavis (self-signed OSS)

Use this for every tagged release. Clavis is **local-first OSS**; builds are **self-signed / unsigned** until store notarization exists. Be honest in release notes about SmartScreen / Gatekeeper warnings.

## Before tagging

- [ ] Version bumped in lockstep:
  - [ ] `Cargo.toml` workspace `version`
  - [ ] `apps/web/package.json`
  - [ ] `apps/desktop/package.json`
  - [ ] `apps/desktop/src-tauri/tauri.conf.json`
- [ ] `pnpm test:vault` passes
- [ ] `pnpm --filter @clavis/web exec tsc --noEmit` passes
- [ ] Smoke: unlock vault, import, copy, lock
- [ ] README / changelog note for user-visible changes (optional short section in release body)

## Build

```bash
pnpm install
pnpm build
```

Artifacts typically land under:

- `target/release/bundle/` (workspace Cargo target — NSIS / MSI / DMG / AppImage / deb — platform dependent)
- Legacy/local: `apps/desktop/src-tauri/target/release/bundle/` if building outside the workspace root

## Checksums

From repo root, after artifacts exist:

```bash
# Windows (Git Bash / PowerShell-friendly via Node)
node scripts/checksum-release.mjs path/to/installer.exe

# Or hash a whole directory of bundles
node scripts/checksum-release.mjs apps/desktop/src-tauri/target/release/bundle
```

Attach `SHA256SUMS.txt` (or paste hashes) on the GitHub Release.

Verify download:

```bash
# Linux / macOS
shasum -a 256 -c SHA256SUMS.txt

# Windows PowerShell
Get-FileHash .\\Clavis_x.y.z_x64-setup.exe -Algorithm SHA256
```

## Tag and publish

```bash
git tag -a vX.Y.Z -m "Clavis X.Y.Z"
git push origin main
git push origin vX.Y.Z
```

**CI matrix behavior**

| Trigger | Tests | Desktop builds |
|---------|-------|----------------|
| Push / PR on `main` | Yes | **Skipped** (intentional cheap gate) |
| Tag `v*` | Yes | Yes — collect from workspace `target/release/bundle` |
| Actions → **Run workflow** (`workflow_dispatch`) | Yes | Yes — re-run full matrix without moving the tag |

A green main push with “Desktop build skipped” does **not** mean release packaging was verified. Fix packaging on `main`, then either move the release tag to that commit or use **Run workflow**.

Tag CI attaches installers + `SHA256SUMS-*.txt` to the GitHub Release automatically (`softprops/action-gh-release`). Actions artifacts remain available as a backup.

Create a GitHub Release for `vX.Y.Z` with:

- Summary of changes
- **Self-signed / unsigned** callout + link to [Installing self-signed builds](../README.md#installing-self-signed-builds)
- Checksums (from CI attach or manual)
- Build-from-source fallback (`pnpm install && pnpm build`)

## Signing notes (current policy)

| Platform | Near-term | User expectation |
|----------|-----------|------------------|
| Windows | Unsigned or self-signed Authenticode | SmartScreen “Unknown publisher” — More info → Run anyway |
| macOS | Ad-hoc / Developer ID when available | Gatekeeper may block — System Settings → Privacy & Security → Open |
| Linux | AppImage / deb as produced | Trust checksum + source tag |

Do **not** claim Microsoft/Apple verified publisher until EV / notarization is real.
