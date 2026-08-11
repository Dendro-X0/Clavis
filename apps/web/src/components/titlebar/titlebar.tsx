"use client";

import { ClavisLogo } from "@/components/brand/clavis-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WindowControls } from "@/components/titlebar/window-controls";
import { cn } from "@/lib/utils";

export function Titlebar({
  className,
  compact = false,
}: {
  className?: string;
  /** Hide desktop window chrome on phone-width / mobile WebView. */
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "relative z-50 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--titlebar)] px-2 select-none",
        compact ? "h-12" : "h-10",
        className,
      )}
    >
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-1"
        {...(!compact ? { "data-tauri-drag-region": true } : {})}
      >
        <ClavisLogo size="sm" className="min-w-0 gap-2" />
        {!compact && (
          <span className="hidden text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase sm:inline">
            Local vault
          </span>
        )}
      </div>
      <div className="flex items-center gap-1" data-tauri-drag-region="false">
        <ThemeToggle />
        {!compact && <WindowControls />}
      </div>
    </header>
  );
}
