"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className={cn("inline-block h-8 w-8", className)} />;
  }

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--accent-wash)] hover:text-[var(--foreground)]",
        className,
      )}
      onClick={async () => {
        const next = isDark ? "light" : "dark";
        setTheme(next);
        try {
          const s = await api.getSettings();
          await api.saveSettings({ ...s, theme: next });
        } catch {
          /* browser preview */
        }
      }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
