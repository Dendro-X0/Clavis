"use client";

import { ModalShell } from "@/components/ui/modal-shell";
import {
  KEYBINDING_GROUPS,
  KEYBINDING_LABELS,
  formatChords,
  resolveBindings,
  type KeybindingOverrides,
} from "@/lib/keybindings";

export function ShortcutsHelp({
  open,
  onClose,
  overrides,
}: {
  open: boolean;
  onClose: () => void;
  overrides?: KeybindingOverrides | Record<string, string> | null;
}) {
  const resolved = resolveBindings(overrides);

  return (
    <ModalShell open={open} onClose={onClose} label="Keyboard shortcuts" panelClassName="max-w-md">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-[var(--foreground)]">Keyboard shortcuts</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Mod is ⌘ on macOS and Ctrl on Windows/Linux. Remap in Settings → Keyboard.
          </p>
        </div>

        {KEYBINDING_GROUPS.map((group) => (
          <div key={group.id}>
            <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
              {group.label}
            </h3>
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {group.actions.map((action) => (
                <li
                  key={action}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-[var(--foreground)]">{KEYBINDING_LABELS[action]}</span>
                  <kbd className="shrink-0 rounded border border-[var(--border)] bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
                    {formatChords(resolved[action])}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Dialogs
          </h3>
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>Confirm</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
                Enter
              </kbd>
            </li>
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>Cancel / close</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
                Esc
              </kbd>
            </li>
          </ul>
        </div>

        <button type="button" className="btn-ghost w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
