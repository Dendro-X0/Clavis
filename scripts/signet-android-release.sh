#!/usr/bin/env bash
# Build Clavis Android APK, Signet-sign, write SHA256SUMS (+ .minisig).
# Requires: JDK (keytool), ANDROID_HOME, Signet CLI, SIGNET_ANDROID_STORE_PASS
# (optional SIGNET_ANDROID_KEY_PASS). Keystore lives in .signet/android/ (gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    "/c/Program Files/Java/jdk-21.0.11" \
    "/c/Program Files/Java/jdk-21" \
    "/c/Program Files/Eclipse Adoptium/jdk-21"* ; do
    if [[ -x "${candidate}/bin/keytool" ]] || [[ -x "${candidate}/bin/keytool.exe" ]]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "error: set ANDROID_HOME / ANDROID_SDK_ROOT" >&2
  exit 1
fi

if [[ -z "${SIGNET_ANDROID_STORE_PASS:-}" && -f .signet/android-store.pass ]]; then
  export SIGNET_ANDROID_STORE_PASS
  SIGNET_ANDROID_STORE_PASS="$(tr -d '\r\n' < .signet/android-store.pass)"
  export SIGNET_ANDROID_KEY_PASS="${SIGNET_ANDROID_KEY_PASS:-$SIGNET_ANDROID_STORE_PASS}"
fi
if [[ -z "${SIGNET_ANDROID_STORE_PASS:-}" ]]; then
  echo "error: set SIGNET_ANDROID_STORE_PASS (or create .signet/android-store.pass locally)" >&2
  exit 1
fi

if [[ ! -f .signet/android/release.jks ]]; then
  echo "error: missing .signet/android/release.jks — run: signet android keystore create" >&2
  exit 1
fi

GEN="apps/mobile/src-tauri/gen/android"
if [[ ! -d "$GEN" ]]; then
  pnpm mobile:android:init
fi

# Windows cross-drive: Cargo registry often on C: while the repo is on another drive.
# Kotlin incremental compile then fails; disable it in the generated project.
PROPS="$GEN/gradle.properties"
if [[ -f "$PROPS" ]] && ! grep -q '^kotlin.incremental=false' "$PROPS"; then
  printf '\n# Clavis: disable Kotlin incremental (cross-drive Windows Cargo registry)\nkotlin.incremental=false\nkotlin.daemon.enabled=false\n' >> "$PROPS"
fi

VERSION="$(node -p "require('./apps/mobile/package.json').version")"
# aarch64 APK is enough for phone sideload; CI Linux can expand ABIs later.
pnpm --filter @clavis/mobile exec tauri android build --apk --target aarch64

# Prefer universal release APK; fall back to abi-specific.
APK="$(find "$GEN/app/build/outputs/apk" -name '*release*.apk' ! -name '*-unsigned.apk' 2>/dev/null | head -1 || true)"
if [[ -z "$APK" ]]; then
  APK="$(find "$GEN/app/build/outputs/apk" -name '*release*.apk' 2>/dev/null | head -1 || true)"
fi
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "error: no release APK under $GEN/app/build/outputs/apk" >&2
  exit 1
fi

mkdir -p dist/android
OUT="dist/android/Clavis-${VERSION}-aarch64.apk"
cp -f "$APK" "$OUT"
signet android sign --apk "$OUT"
signet build --target android --skip-build --artifact "$OUT"
if [[ -d .signet/identity ]]; then
  signet trust
else
  echo "note: no .signet/identity — skipping signet trust (committed TRUST.md is authoritative for CI)"
fi

echo "ok: $OUT"
echo "    SHA256SUMS updated; TRUST.md refreshed only when identity present"
echo "    cert digest: $(signet android keystore show | grep -i 'SHA-256' | head -1)"
