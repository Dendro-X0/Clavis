"use client";

import { X } from "lucide-react";
import { formatActionChord } from "@/lib/keybindings";

export function OnboardingTip({
  onDismiss,
  onImportHint,
  keybindingOverrides,
}: {
  onDismiss: () => void;
  onImportHint?: () => void;
  keybindingOverrides?: Record<string, string> | null;
}) {
  const actionKbd = (action: Parameters<typeof formatActionChord>[0]) => (
    <kbd className="rounded border border-[var(--border)] px-1 text-[10px]">
      {formatActionChord(action, keybindingOverrides)}
    </kbd>
  );

  return (
    <div className="mb-3 flex shrink-0 items-start gap-3 rounded-md border border-[var(--primary)]/35 bg-[var(--accent-wash)] px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--foreground)]">Welcome to Clavis</p>
        <p className="mt-1 text-[var(--muted)]">
          Import a credentials file to create a workspace, or add an entry.{" "}
          <span className="text-[var(--foreground)]">Copy</span> pastes username then password
          for login forms. Shortcuts: {actionKbd("search")} search · {actionKbd("palette")} palette ·{" "}
          {actionKbd("newEntry")} new · {actionKbd("lock")} lock · {actionKbd("shortcutsHelp")} help.
        </p>
        {onImportHint && (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={onImportHint}
          >
            Open Settings → Import
          </button>
        )}
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
