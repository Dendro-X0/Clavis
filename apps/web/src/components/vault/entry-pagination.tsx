"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function normalizePageSize(value: number | undefined): PageSize {
  if (value === 10 || value === 25 || value === 50 || value === 100) return value;
  return 25;
}

export function EntryPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <span>Per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(normalizePageSize(Number(v)))}
        >
          <SelectTrigger className="h-8 w-[88px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular-nums">
          {from}–{to} of {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)] disabled:opacity-40"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[4.5rem] text-center tabular-nums text-[var(--muted)]">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)] disabled:opacity-40"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
