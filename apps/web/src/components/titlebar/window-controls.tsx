"use client";

import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function getWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function WindowControls({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        aria-label="Minimize"
        className="inline-flex h-8 w-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent-wash)] hover:text-[var(--foreground)]"
        onClick={() => getWindow().then((w) => w.minimize()).catch(() => undefined)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Maximize"
        className="inline-flex h-8 w-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent-wash)] hover:text-[var(--foreground)]"
        onClick={() =>
          getWindow()
            .then(async (w) => {
              if (await w.isMaximized()) await w.unmaximize();
              else await w.maximize();
            })
            .catch(() => undefined)
        }
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="Close"
        className="inline-flex h-8 w-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)]"
        onClick={() => getWindow().then((w) => w.close()).catch(() => undefined)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
