"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function CopyIconButton({
  value,
  label,
  onCopied,
  onError,
  className,
}: {
  value: string;
  label: string;
  onCopied?: () => void;
  onError?: (message: string) => void;
  className?: string;
}) {
  const [flash, setFlash] = useState(false);

  return (
    <button
      type="button"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      disabled={!value}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--border)] p-2 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40",
        flash && "animate-copy border-[var(--primary)] text-[var(--primary)]",
        className,
      )}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await copyToClipboard(value);
          setFlash(true);
          onCopied?.();
          window.setTimeout(() => setFlash(false), 700);
        } catch (err) {
          onError?.(String(err).replace(/^Error:\s*/, ""));
        }
      }}
    >
      {flash ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
