# Release checklist — Clavis (self-signed OSS)

Use this for every tagged release. Clavis is **local-first OSS**; builds are **self-signed / unsigned** until store notarization exists. Be honest in release notes about SmartScreen / Gatekeeper / Android sideload / iOS free-provisioning warnings.

## Before tagging

- [ ] Version bumped in lockstep:
  - [ ] `Cargo.toml` workspace `version`
  - [ ] `apps/web/package.json`
  - [ ] `apps/desktop/package.json`
  - [ ] `apps/mobile/package.json`
  - [ ] `apps/desktop/src-tauri/tauri.conf.json`
  - [ ] `apps/mobile/src-tauri/tauri.conf.json`
- [ ] `pnpm test:vault` passes
- [ ] `pnpm --filter @clavis/web exec tsc --noEmit` passes
- [ ] Smoke: unlock vault, import, copy, lock (desktop; mobile when available)
- [ ] `signet doctor` / `signet ship --plan` (optional local) — see [signet-ship.md](signet-ship.md)
- [ ] GitHub secrets for Android ship present (`SIGNET_ANDROID_*`) if tagging a mobile release
- [ ] `TRUST.md` up to date (`signet trust` after keystore/identity changes)
- [ ] README / changelog note for user-visible changes (optional short section in release body)

## Build

```bash
pnpm install
pnpm build                    # desktop
pnpm signet:android           # local Android APK + Signet sign (optional)
pnpm signet:ios               # macOS only
```

Artifacts typically land under:

- Desktop: `target/release/bundle/` (workspace Cargo target)
- Android: `dist/android/*.apk` via `pnpm signet:android`
- iOS: `dist/ios/*.ipa` via `pnpm signet:ios`

## Checksums

From repo root, after artifacts exist:

```bash
# Desktop (Node helper)
node scripts/checksum-release.mjs --out SHA256SUMS-windows.txt path/to/installer.exe

# Signet (Android/iOS + minisig when sums key exists)
pnpm signet:android
# or: signet build --target android --skip-build --artifact dist/android/Clavis-*.apk
```

Attach `SHA256SUMS` / `SHA256SUMS-*.txt` / `.minisig` on the GitHub Release. Prefer verifying against committed `TRUST.md` fingerprints.

Verify download:

```bash
# Linux / macOS
shasum -a 256 -c SHA256SUMS

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

| Trigger | `ci.yml` tests | `ci.yml` desktop | `signet-ship.yml` Android/iOS |
|---------|----------------|------------------|------------------------------|
| Push / PR on `main` | Yes | **Skipped** | No |
| Tag `v*` | Yes | Yes — attach desktop installers | Yes — APK (+ IPA if signing works) |
| Actions → **Run workflow** | Yes | Yes | Yes (`signet-ship` dispatch) |

A green main push with “Desktop build skipped” does **not** mean release packaging was verified. Fix packaging on `main`, then either move the release tag to that commit or use **Run workflow**.

- Desktop: `.github/workflows/ci.yml` attaches installers + `SHA256SUMS-*.txt`
- Mobile: `.github/workflows/signet-ship.yml` attaches APK/IPA + Signet `SHA256SUMS` — secrets in [signet-ship.md](signet-ship.md)

Create a GitHub Release for `vX.Y.Z` with:

- Summary of changes
- **Self-signed / unsigned / sideload** callout + link to [Installing self-signed builds](../README.md#installing-self-signed-builds)
- Checksums (from CI attach or manual)
- Build-from-source fallback (`pnpm install && pnpm build`)
- Mobile honesty: Android sideload ≠ Play; iOS IPA ≠ App Store (`signet ios notes`)

## Signing notes (current policy)

| Platform | Near-term | User expectation |
|----------|-----------|------------------|
| Windows | Unsigned or self-signed Authenticode | SmartScreen “Unknown publisher” — More info → Run anyway |
| macOS | Ad-hoc / Developer ID when available | Gatekeeper may block — System Settings → Privacy & Security → Open |
| Linux | AppImage / deb as produced | Trust checksum + source tag |
| Android | Signet project keystore (sideload) | Install unknown apps; cert in `TRUST.md` ≠ Play App Signing |
| iOS | Xcode-signed `.app` + `signet ios package` | Free provisioning ~7 days; not TestFlight/App Store |

Do **not** claim Microsoft/Apple/Google verified publisher until EV / notarization / Play App Signing is real.
