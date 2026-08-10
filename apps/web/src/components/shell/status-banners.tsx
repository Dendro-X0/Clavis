"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Messages that are informational / success rather than failures. */
export function isSuccessTone(message: string): boolean {
  const m = message.trim();
  return (
    /^(Imported|Replaced|Username copied|Password copied|Merged|No duplicate|Data directory|Vault snapshot|TOTP code copied|KDF upgraded|Exported|Portable data)/i.test(
      m,
    ) || /\bcopied\b/i.test(m)
  );
}

export function StatusBanners({
  error,
  notice,
  onDismissError,
  onDismissNotice,
}: {
  error: string | null;
  notice: string | null;
  onDismissError: () => void;
  onDismissNotice: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(onDismissNotice, 4200);
    return () => window.clearTimeout(id);
  }, [notice, onDismissNotice]);

  if (!error && !notice) return null;

  return (
    <div className="mb-3 flex shrink-0 flex-col gap-2">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2.5 text-sm"
        >
          <p className="min-w-0 flex-1 text-[var(--foreground)]">{error}</p>
          <button
            type="button"
            aria-label="Dismiss error"
            className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
            onClick={onDismissError}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-start gap-2 rounded-md border border-[var(--primary)]/35 bg-[var(--accent-wash)] px-3 py-2.5 text-sm",
          )}
        >
          <p className="min-w-0 flex-1 text-[var(--foreground)]">{notice}</p>
          <button
            type="button"
            aria-label="Dismiss notice"
            className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
            onClick={onDismissNotice}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
