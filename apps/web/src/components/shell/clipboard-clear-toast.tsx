"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClipboardClearToast({
  endsAt,
  onDismiss,
  className,
}: {
  /** Epoch ms when clipboard will be cleared; null hides the toast. */
  endsAt: number | null;
  onDismiss: () => void;
  className?: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (endsAt == null) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) onDismiss();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, onDismiss]);

  if (endsAt == null || secondsLeft <= 0) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 bottom-4 z-[60] flex max-w-sm items-center gap-3 rounded-lg border border-[var(--primary)]/35 bg-[var(--card)] px-4 py-3 text-sm shadow-lg backdrop-blur-md",
        className,
      )}
    >
      <p className="min-w-0 text-[var(--foreground)]">
        Clipboard clears in{" "}
        <span className="font-medium tabular-nums text-[var(--primary)]">{secondsLeft}s</span>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
