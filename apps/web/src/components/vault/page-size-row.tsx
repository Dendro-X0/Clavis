"use client";

import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function normalizePageSize(value: number | undefined): PageSize {
  if (value === 10 || value === 25 || value === 50 || value === 100) return value;
  return 25;
}

export function PageSizeRow({
  value,
  onChange,
  label = "Entries per page",
  size = "md",
  className,
}: {
  value: number | undefined;
  onChange: (size: PageSize) => void;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const selected = normalizePageSize(value);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full min-w-0 flex-wrap rounded-md border border-[var(--border)] p-0.5",
        className,
      )}
    >
      {PAGE_SIZE_OPTIONS.map((n) => {
        const active = selected === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(n)}
            className={cn(
              "min-w-0 flex-1 touch-target rounded px-2 text-center tabular-nums transition",
              size === "sm" ? "min-h-8 py-1 text-xs" : "min-h-9 py-1.5 text-sm",
              active
                ? "bg-[var(--accent-wash)] font-medium text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
