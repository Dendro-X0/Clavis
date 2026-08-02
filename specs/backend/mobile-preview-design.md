# Design — Phase C mobile preview

**Status:** approved for implementation  
**Band:** Phase C (roadmap)  
**Owners:** `vault-core` (crypto), `crates/clavis-shell` (IPC), `apps/mobile` (Tauri mobile), `apps/web` (UI)

## Goal

Ship a **preview** Android/iOS shell that reuses the same vault format and IPC as desktop — not a store-ready product. Signing stays OSS / self-signed.

## Non-goals (Phase C)

- Clavis cloud sync or accounts
- Second crypto stack outside `vault-core`
- Full share-sheet import pipeline (stub / document; desktop file pick remains)
- Play Store / App Store listing or notarization
- Hardware passkey unlock

## Architecture

```
crates/vault-core          ← unchanged owner of KDF + AEAD + vault.km
crates/clavis-shell        ← shared Tauri commands / paths / state / builder attach
apps/desktop/src-tauri     ← desktop entry + generate_context!
apps/mobile/src-tauri      ← mobile_entry_point + generate_context! (+ gen/android|ios)
apps/web                   ← single UI; compact/touch surface via CSS + chrome gates
```

Desktop and mobile both call `clavis_shell::attach(Builder)` then `.run(generate_context!())` in their own crate (context must live next to each `tauri.conf.json`).

## Data directory

| Surface | Default | Custom override |
|---------|---------|-----------------|
| Desktop | `{exe}/data/` (portable) | `data-location.json` (Phase B) |
| Mobile | OS app data dir (`app_data_dir` / sandboxed) | **Not offered in UI** (preview) |

Invariant: vault file remains `vault.km` under the resolved data dir; encrypted at rest.

## Biometric / keyring

- Keep Settings flag `biometricUnlock` and existing keyring commands.
- Mobile preview: OS keyring / Keystore where `keyring` crate works; document gaps per OS in `docs/platforms.md`.
- Master password always recovers the vault. No secrets in notifications.

## Import (preview)

- Prefer same IPC: `pick_open_path` / `import_*` via dialog plugin when available on Android.
- Share-sheet / Files intent: **documented follow-up**; not blocking shell boot.

## Threat model

Expand `docs/threat-model.md` mobile section with concrete statuses (backup, screenshots, notifications, biometric). Secure-window / FLAG_SECURE hooks are **best-effort** where APIs exist; document when unimplemented.

## UI contract (see `docs/frontend-spec.md`)

- Compact surface (`max-width ~768px` or `data-surface=compact`): hide window controls, simplify titlebar, sidebar collapsed by default, larger tap targets (≥44px).
- Prefer list layout; keep grid available.
- No new marketing chrome; same tokens.

## Proof plan

| Layer | Command / check |
|-------|-----------------|
| L1 | `cargo check -p keys-manager -p clavis-mobile -p clavis-shell` · `pnpm --filter @clavis/web exec tsc --noEmit` (or project typecheck) |
| L2 | `pnpm test:vault` |
| L3 | `pnpm --filter @clavis/mobile exec tauri android init --ci` (once); build only if SDK/NDK present — record skip if not |
| Claim language | Shell **scaffolded**; Android **init** ≠ store-ready **verified** |

## Atomic slices

1. Specs + threat-model + platforms docs  
2. Extract `clavis-shell`; desktop still runs  
3. Scaffold `apps/mobile` + android init when possible  
4. Compact / touch UI in shared web  
5. Roadmap Phase C progress table  
