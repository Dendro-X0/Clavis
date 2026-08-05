# Platforms — desktop + mobile preview

Clavis targets **Windows, macOS, and Linux** (desktop) and a **Phase C mobile preview** (Android / iOS via Tauri v2). Releases are **OSS · self-signed / unsigned** until store notarization exists.

## Desktop shells

| OS | Bundle (typical) | CI artifact job | Notes |
|----|------------------|-----------------|-------|
| Windows | NSIS / MSI / `.exe` | `clavis-windows-v*` | SmartScreen expected |
| macOS | `.dmg` / `.app.zip` | `clavis-macos-v*` | Gatekeeper / ad-hoc signing |
| Linux | `.AppImage` / `.deb` | `clavis-linux-v*` | Verify checksum; WebKitGTK runtime |

Build from source on any host with Rust + pnpm + [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm build
```

Tag builds: push `vX.Y.Z` → CI runs `test` then matrix desktop builds and uploads artifacts + `SHA256SUMS-*.txt`.

## Mobile preview (Phase C)

| OS | Shell | Notes |
|----|-------|--------|
| Android | `apps/mobile` + `tauri android` | Requires Android SDK/NDK; vault in app sandbox |
| iOS | `apps/mobile` + `tauri ios` | macOS + Xcode only; not built on Windows CI yet |

Native projects under `apps/mobile/src-tauri/gen/` are **not committed**. Init once per machine (or in CI before build):

```bash
pnpm install
pnpm mobile:android:init   # once (Android SDK)
pnpm --filter @clavis/mobile android:dev
# macOS + Xcode:
pnpm mobile:ios:init
pnpm --filter @clavis/mobile ios:dev
```

Release builds: `pnpm build:mobile:android` / `pnpm build:mobile:ios`. Signing/packaging for GitHub Releases uses root `signet.toml` + [Signet](https://github.com/Dendro-X0/Signet) (`ship.path = "self"`).

Shared stack: `crates/vault-core` + `crates/clavis-shell` + `apps/web` (compact UI under 768px).

### Mobile data directory

Uses the OS **app data** directory (sandboxed). Custom folder picker is **desktop-only**. OS cloud backups may copy the encrypted `vault.km` ciphertext — treat device backup policy as part of your threat model.

### Mobile keyring / biometric

**Off by default.** Enable in Settings → “Convenience unlock”: stores the master password in the OS keyring/Keystore. On mobile, Gate uses **`tauri-plugin-biometric`** before `try_keyring_unlock`. Master password always recovers the vault. Gate does not offer a remember-me opt-in. Desktop silent keyring try runs only when the setting is on and biometrics are unavailable. Secure-flag / screenshot mitigations remain planned.

### Import on mobile

File dialogs via Tauri dialog plugin when available. Share-sheet / Files intent import is a follow-up.

## Desktop data directory

| Mode | Location | How |
|------|----------|-----|
| **Portable (default)** | `{executable_directory}/data/` | No pointer file |
| **Custom** | User-chosen folder | Settings → Change data folder… writes `{exe}/data-location.json` |

### USB / plug-and-play kit

1. Prefer **portable default** (no `data-location.json`).
2. Copy the **entire install folder** (binary + `data/` containing encrypted `vault.km`) to a USB drive or another PC.
3. Absolute custom data paths break when drive letters change — Settings warns and offers **Make portable** (copies vault + config into `{exe}/data/` and removes the override).
4. Disable convenience unlock (OS keyring) on shared/USB kits — keyring is machine-local.

- Changing the folder **locks** the vault; use Make portable or copy files yourself when migrating.
- Reset with **Use portable default** (removes `data-location.json` without copying).
- Env/profile OS folders are never the default dump location.

## Keyring / “Remember unlock”

Optional OS keyring storage of the master password for convenience unlock (`biometricUnlock` in Settings, **default off**).

| Platform | Backend (keyring crate) | Typical UX |
|----------|-------------------------|------------|
| Windows | Credential Manager | “Remember unlock via OS keyring” |
| macOS | Keychain | Same checkbox; may prompt for keychain access |
| Linux | Secret Service (libsecret) / fallback | Needs a running secrets daemon (GNOME Keyring, KWallet, etc.) |
| Android / iOS | Keystore / Keychain (where supported) + `tauri-plugin-biometric` Gate | “Unlock with biometrics” then keyring; password fallback |

**Security notes**

- Keyring unlock is **optional**; master password always recovers the vault.
- Compromised OS keyring is in the threat model as an accepted risk when enabled.
- Disable in Settings and clear keyring secret when leaving a shared machine.

## Self-signed install reminders

See README [Installing self-signed builds](../README.md#installing-self-signed-builds) and [docs/release-checklist.md](release-checklist.md).

## Out of scope for Phase C preview

- App Store / Play Store listing
- Apple notarization / Windows EV Authenticode
- Auto-update channel
- Full share-sheet import

## Next — v0.9.0 mobile installers

Sideloadable Android/iOS artifacts on GitHub Releases, signed/packaged with **[Signet](https://github.com/Dendro-X0/Signet)** (`ship.path = "self"`): Android keystore sideload signing, `signet ios package` for IPA, `SHA256SUMS` + `TRUST.md`. Still **not** store listings. See `specs/backend/v0.9.0-mobile-installers-design.md` and Signet docs (`signing.md`, `android.md`, `ios.md`, `ship.md`).

### Android sideload (local / CI)

```bash
pnpm mobile:android:init          # once (gen/ gitignored)
# create keystore once (gitignored .signet/):
#   export SIGNET_ANDROID_STORE_PASS='…'
#   signet android keystore create --dname "CN=Clavis Android,O=Clavis,C=US"
#   signet trust                  # refreshes committed TRUST.md
pnpm signet:android               # build aarch64 APK → Signet-sign → SHA256SUMS
```

Requires JDK (`keytool` on `PATH` / `JAVA_HOME`), `ANDROID_HOME`, and Signet on `PATH`. On Windows, if Cargo’s registry is on another drive than the repo, the release script disables Kotlin incremental compile in `gen/android/gradle.properties` (cross-drive bug). Sideload cert ≠ Play App Signing — see `TRUST.md`.

### iOS sideload (macOS + Xcode)

```bash
pnpm mobile:ios:init              # once (gen/ gitignored; macOS only)
pnpm signet:ios                   # tauri ios build → signet ios package → SHA256SUMS
# or package an existing .app:
#   SKIP_IOS_BUILD=1 IOS_APP=/path/to/Clavis.app pnpm signet:ios
```

Signet **packages** IPA (`Payload/*.app` zip) — it does **not** App Store–sign. Free Apple ID development provisioning lasts ~7 days (`signet ios notes`). Device IPA in CI needs Apple signing secrets; without them, ship a documented simulator/dev build only.

Package-path smoke (any OS, not installable): `pnpm signet:ios:fixture`.

### CI (v0.9.0+)

| Workflow | Role |
|----------|------|
| `.github/workflows/ci.yml` | Tests + desktop matrix on `v*` tags; attaches desktop installers |
| `.github/workflows/signet-ship.yml` | Android APK (Signet-signed) + iOS IPA package on `v*` / `workflow_dispatch` |

Secrets and collect flow: [docs/signet-ship.md](signet-ship.md). Root config: `signet.toml` (`ship.path = "self"`).
