# Design — Post-0.9.0 friction & vault hygiene (umbrella)

**Status:** roadmap umbrella (v0.10–v0.13 done)  
**Bands:** v0.10 → v0.11 → v0.12 → v0.13
**Stance:** local-first; no Clavis cloud; `allowNetwork` stays default **off**

## North star

After mobile installers (v0.9.0), prioritize **daily friction** and **local trust UX** before folder sync / store signing (Phase D remainder).

## Band map

| Version | Theme | Design |
|---------|--------|--------|
| **0.10** | Generate, quick-add, soft-delete | `v0.10.0-generate-capture-design.md` |
| **0.11** | Password health + optional breach pack | `v0.11.0-password-health-design.md` |
| **0.12** | Desktop autotype + URL/app match | `v0.12.0-desktop-fill-match-design.md` |
| **0.13** | Attachments, snapshots, structured notes | `v0.13.0-vault-richness-design.md` |

**Do not** merge soft-delete, snapshots, and folder-sync conflict UI in one band — one lifecycle owner in `vault-core` at a time.

## v0.11 — Password health (stub)

**Goals:** Workspace-scoped report: reused passwords, short/weak charset, optional tiny local denylist. No phone-home.

**HIBP / breach:** Default off. Options (pick in detailed design): (a) bundled/offline range file, or (b) opt-in k-anonymity **only if** `allowNetwork` on **and** user enables “check breaches.” Never imply continuous monitoring.

**Non-goals:** Cloud account scoring, forcing password changes, uploading vault.

**Depends on:** Soft-delete (0.10) so trash isn’t scored as active reuse noise (or score with explicit “include trash”).

## v0.12 — Desktop fill & match (stub)

**Goals:** Autotype into focused window; opt-in suggest entries from foreground window title / browser URL; confirm before fill; Windows first.

**Threats to document first:** keystroke injection to wrong window, title spoofing, malware same-user (already out of scope while unlocked — shorten window with confirm + lock).

**Non-goals:** Browser extension that phones home; global keylogger; auto-fill without gesture.

**Depends on:** Stable entry URL fields; generator optional for “fill new password” flows later.

## v0.13 — Vault richness

**Design:** `v0.13.0-vault-richness-design.md` (done — v0.13.0)

**Shipped surface:**

- Encrypted **attachments** per entry (256 KiB / 5; purge deletes sidecars).
- **Snapshots** — dated `vault.km` copies; retain N; restore + re-unlock.
- **Structured notes** — `notes_format` plain|markdown; searchable; simple preview.

**Non-goals:** Clavis cloud backup; unlimited blob storage.

**Phase D interaction**

Folder sync of `vault.km` stays Phase D. When sync lands, it must respect soft-delete + snapshot semantics from 0.10/0.13 — design sync **after** those owners exist or with an explicit compatibility section.

**v0.14 design (ready):** `specs/backend/v0.14.0-folder-sync-design.md` — optional user data-dir / Syncthing folder; whole-blob LWW; external change forces lock.
