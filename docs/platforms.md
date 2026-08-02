# Platforms — desktop matrix (Phase B)

Clavis desktop targets **Windows, macOS, and Linux** via Tauri v2 + shared `vault-core`. Releases are **OSS · self-signed / unsigned** until store notarization exists.

## Supported shells

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

## Data directory

| Mode | Location | How |
|------|----------|-----|
| **Portable (default)** | `{executable_directory}/data/` | No pointer file |
| **Custom** | User-chosen folder | Settings → Change data folder… writes `{exe}/data-location.json` |

- Changing the folder **locks** the vault; copy `vault.km` / `config.json` yourself if migrating.
- Reset with **Use portable default** (removes `data-location.json`).
- Env/profile OS folders are never the default dump location.

## Keyring / “Remember unlock”

Optional OS keyring storage of the master password for convenience unlock (`biometricUnlock` in settings).

| Platform | Backend (keyring crate) | Typical UX |
|----------|-------------------------|------------|
| Windows | Credential Manager | “Remember unlock via OS keyring” |
| macOS | Keychain | Same checkbox; may prompt for keychain access |
| Linux | Secret Service (libsecret) / fallback | Needs a running secrets daemon (GNOME Keyring, KWallet, etc.) |

**Security notes**

- Keyring unlock is **optional**; master password always recovers the vault.
- Compromised OS keyring is in the threat model as an accepted risk when enabled.
- Disable in Settings and clear keyring secret when leaving a shared machine.

## Self-signed install reminders

See README [Installing self-signed builds](../README.md#installing-self-signed-builds) and [docs/release-checklist.md](release-checklist.md).

## Out of scope for Phase B

- iOS / Android (Phase C)
- Apple notarization / Windows EV Authenticode
- Auto-update channel
