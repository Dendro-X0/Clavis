#!/usr/bin/env bash
# Build Clavis iOS .app (macOS + Xcode), package IPA with Signet, write SHA256SUMS.
# Signet does NOT App Store-sign — free provisioning ~7 days; see `signet ios notes`.
#
# Env:
#   SKIP_IOS_BUILD=1  — package an existing .app only (set IOS_APP)
#   IOS_APP           — path to Clavis.app when skipping build
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

signet ios notes || true

if [[ "$(uname -s)" != "Darwin" && -z "${SKIP_IOS_BUILD:-}" && -z "${IOS_APP:-}" ]]; then
  echo "error: tauri ios build requires macOS + Xcode." >&2
  echo "  On this host, use CI (slice 5) or:" >&2
  echo "    SKIP_IOS_BUILD=1 IOS_APP=/path/to/Clavis.app bash scripts/signet-ios-release.sh" >&2
  echo "  Package-only proof (any OS): bash scripts/signet-ios-package-fixture.sh" >&2
  exit 1
fi

VERSION="$(node -p "require('./apps/mobile/package.json').version")"
mkdir -p dist/ios

if [[ -n "${IOS_APP:-}" ]]; then
  APP="$IOS_APP"
elif [[ -n "${SKIP_IOS_BUILD:-}" ]]; then
  echo "error: SKIP_IOS_BUILD=1 requires IOS_APP=/path/to/Clavis.app" >&2
  exit 1
else
  GEN_APPLE="apps/mobile/src-tauri/gen/apple"
  GEN_IOS="apps/mobile/src-tauri/gen/ios"
  if [[ ! -d "$GEN_APPLE" && ! -d "$GEN_IOS" ]]; then
    pnpm mobile:ios:init
  fi
  pnpm build:mobile:ios

  APP="$(find apps/mobile/src-tauri/gen -type d -name 'Clavis.app' 2>/dev/null | head -1 || true)"
  if [[ -z "$APP" ]]; then
    APP="$(find apps/mobile/src-tauri/gen -type d -name '*.app' 2>/dev/null | head -1 || true)"
  fi
  if [[ -z "$APP" || ! -d "$APP" ]]; then
    echo "error: no .app under apps/mobile/src-tauri/gen after ios build" >&2
    exit 1
  fi
fi

if [[ ! -d "$APP" ]]; then
  echo "error: not an .app bundle: $APP" >&2
  exit 1
fi

OUT="dist/ios/Clavis-${VERSION}.ipa"
signet ios package --app "$APP" --out "$OUT"
signet build --target ios --skip-build --artifact "$OUT"
if [[ -d .signet/identity ]]; then
  signet trust
else
  echo "note: no .signet/identity — skipping signet trust (committed TRUST.md is authoritative for CI)"
fi

echo "ok: $OUT"
echo "    SHA256SUMS updated; TRUST.md refreshed only when identity present"
echo "    honesty: packaging != App Store / TestFlight — $(signet ios notes 2>/dev/null | head -1)"
