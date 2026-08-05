#!/usr/bin/env bash
# Prove `signet ios package` + checksum on any host (no Xcode).
# Builds a minimal Payload-ready .app fixture, packages IPA, writes SHA256SUMS entry.
# Does NOT claim a shippable Clavis iOS installer — use signet-ios-release.sh on macOS/CI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./apps/mobile/package.json').version")"
FIX="dist/ios-fixture/Clavis.app"
rm -rf dist/ios-fixture
mkdir -p "$FIX"

# Minimal bundle layout so the IPA is a valid zip(Payload/Clavis.app/…)
cat > "$FIX/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.keysmanager.mobile</string>
  <key>CFBundleName</key>
  <string>Clavis</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>Clavis</string>
</dict>
</plist>
PLIST
printf 'clavis-ios-fixture\n' > "$FIX/Clavis"

mkdir -p dist/ios
OUT="dist/ios/Clavis-${VERSION}-fixture.ipa"
signet ios package --app "$FIX" --out "$OUT"
signet build --target ios --skip-build --artifact "$OUT"

# Sanity: IPA is a zip containing Payload/
python - <<PY
import zipfile, sys
z = zipfile.ZipFile(r"$OUT")
names = z.namelist()
assert any(n.startswith("Payload/Clavis.app/") for n in names), names
print("ipa_payload_ok:", len(names), "entries")
PY

echo "ok: fixture IPA $OUT (not for device install)"
signet ios notes || true
