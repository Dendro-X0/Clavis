"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PageSizeRow,
  type PageSize,
} from "@/components/vault/page-size-row";
import { cn } from "@/lib/utils";

export {
  PAGE_SIZE_OPTIONS,
  normalizePageSize,
  type PageSize,
} from "@/components/vault/page-size-row";

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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[var(--muted)]">
        <span className="shrink-0">Per page</span>
        <PageSizeRow
          value={pageSize}
          onChange={onPageSizeChange}
          label="Entries per page"
          size="sm"
          className="max-w-[16rem] sm:max-w-[18rem]"
        />
        <span className="tabular-nums">
          {from}–{to} of {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="touch-target rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)] disabled:opacity-40"
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
          className="touch-target rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)] disabled:opacity-40"
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
