# Signet ship secrets (CI)

Private material stays out of git (`.signet/` is gitignored). Tag / `workflow_dispatch` for `.github/workflows/signet-ship.yml` needs:

| Secret | Purpose |
|--------|---------|
| `SIGNET_ANDROID_STORE_PASS` | Keystore password (`SIGNET_ANDROID_STORE_PASS`) |
| `SIGNET_ANDROID_KEYSTORE_BASE64` | `base64 -w0 .signet/android/release.jks` (Git Bash: `base64 -w0` or `openssl base64 -A -in …`) |
| `SIGNET_ANDROID_KEY_PASS` | Optional; defaults to store pass |

Optional **variable** (not secret): `CLAVIS_IOS_ALLOW_SKIP=1` — lets the iOS job exit 0 without an IPA (explicit partial release). Default is **fail** if IPA missing.

## One-time local keystore (maintainer)

```bash
export SIGNET_ANDROID_STORE_PASS='…'   # strong; store in password manager + GH secret
signet android keystore create --dname "CN=Clavis Android,O=Clavis,C=US" --alias signet
signet trust   # refresh committed TRUST.md
# Upload secrets:
#   SIGNET_ANDROID_STORE_PASS
#   SIGNET_ANDROID_KEYSTORE_BASE64="$(openssl base64 -A -in .signet/android/release.jks)"
```

## Collect after CI (optional)

```bash
# Download Actions artifacts for the tag into ./ship-artifacts/
signet ship --collect ./ship-artifacts
signet ship --plan
# signet release --tag vX.Y.Z   # when GitHub auth ready
```

Desktop installers still come from `.github/workflows/ci.yml`. Mobile APK/IPA from `signet-ship.yml`.
