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

```bash
pnpm install
pnpm --filter @clavis/mobile android:init   # once per machine
pnpm --filter @clavis/mobile android:dev    # emulator / device
```

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
