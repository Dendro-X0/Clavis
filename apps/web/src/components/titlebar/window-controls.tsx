"use client";

import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function getWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const w = await getWindow();
        if (cancelled) return;
        setMaximized(await w.isMaximized());
        unlisten = await w.onResized(async () => {
          try {
            setMaximized(await w.isMaximized());
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* browser / no Tauri window */
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

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
        aria-label={maximized ? "Restore" : "Maximize"}
        title={maximized ? "Restore" : "Maximize"}
        className="inline-flex h-8 w-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--accent-wash)] hover:text-[var(--foreground)]"
        onClick={() =>
          getWindow()
            .then(async (w) => {
              if (await w.isMaximized()) {
                await w.unmaximize();
                setMaximized(false);
              } else {
                await w.maximize();
                setMaximized(true);
              }
            })
            .catch(() => undefined)
        }
      >
        {maximized ? (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Square className="h-3 w-3" aria-hidden />
        )}
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
