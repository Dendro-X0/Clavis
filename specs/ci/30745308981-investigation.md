# CI investigation — Desktop collect artifacts empty

**Run:** https://github.com/Dendro-X0/Clavis/actions/runs/30745308981 (`v0.4.0` tag)  
**Jobs:** Desktop build windows / ubuntu-22.04 / macos-latest  
**Step:** Collect artifacts + checksums  
**Failure class:** workflow (wrong artifact path)

## Exact error

```
mkdir -p release-out
… (release-out empty) …
No files found.
exit code 1
```

## Evidence

Build step **succeeded** on all three OS. Bundles were written to the **Cargo workspace root**:

| OS | Actual path |
|----|-------------|
| macOS | `…/Clavis/target/release/bundle/dmg/Clavis_0.4.0_aarch64.dmg` (+ `.app`) |
| Linux | `…/Clavis/target/release/bundle/{deb,rpm,appimage}/…` |
| Windows | `…/Clavis/target/release/bundle/{msi,nsis}/…` |

Collect step looked only at `apps/desktop/src-tauri/target/release/bundle` (missing) and package-local binaries under the same wrong prefix.

## Primary failure class

**workflow** — path mismatch after workspace layout; not a compile/link failure.

## Fix (this iteration only)

Point collect + binary fallbacks at `target/release/bundle` (repo root), keep package-local path as secondary fallback. Update release-checklist path note.
