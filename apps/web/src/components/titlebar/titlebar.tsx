"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { WindowControls } from "@/components/titlebar/window-controls";
import { cn } from "@/lib/utils";

export function Titlebar({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "relative z-50 flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--titlebar)] px-2 select-none",
        className,
      )}
    >
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-2 pl-1"
        data-tauri-drag-region
      >
        <span className="font-display text-[15px] tracking-tight text-[var(--foreground)]">
          Clavis
        </span>
        <span className="hidden text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase sm:inline">
          Local vault
        </span>
      </div>
      <div className="flex items-center gap-1" data-tauri-drag-region="false">
        <ThemeToggle />
        <WindowControls />
      </div>
    </header>
  );
}
