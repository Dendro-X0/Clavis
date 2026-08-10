"use client";

import { FolderPlus, LayoutGrid, LayoutList, Pencil, Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceSummary } from "@/lib/api";

export type EntryLayout = "list" | "grid";

export function DashboardHeader({
  workspaces,
  entryCount,
  query,
  onQueryChange,
  layout,
  onLayoutChange,
  categoryFilter,
  categories,
  onCategoryFilter,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onTogglePinWorkspace,
  pinnedWorkspaceIds = [],
  onReplace,
  onNewEntry,
  onNewFromClipboard,
}: {
  workspaces: WorkspaceSummary[];
  entryCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  layout: EntryLayout;
  onLayoutChange: (layout: EntryLayout) => void;
  categoryFilter: string | null;
  categories: string[];
  onCategoryFilter: (tag: string | null) => void;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onTogglePinWorkspace?: (id: string) => void;
  pinnedWorkspaceIds?: string[];
  onReplace: () => void;
  onNewEntry: () => void;
  onNewFromClipboard?: () => void;
}) {
  const active = workspaces.find((w) => w.active);
  const canDelete = workspaces.length > 1;
  const pinned = new Set(pinnedWorkspaceIds);

  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <p className="shrink-0 text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Workspaces
        </p>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scroll-region pb-0.5">
          {workspaces.map((ws) => {
            const isPinned = pinned.has(ws.id);
            return (
              <div
                key={ws.id}
                className={cn(
                  "group flex shrink-0 items-center gap-0.5 rounded-lg border pl-1 pr-0.5 transition",
                  ws.active
                    ? "border-[var(--primary)]/40 bg-[var(--accent-wash)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/25",
                )}
              >
                <button
                  type="button"
                  aria-pressed={ws.active}
                  aria-label={`${ws.name}, ${ws.entryCount} entries${ws.active ? ", active" : ""}`}
                  onClick={() => onSelectWorkspace(ws.id)}
                  className="flex max-w-[10rem] items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <span className="truncate font-medium text-[var(--foreground)]">{ws.name}</span>
                  <span className="tabular-nums text-[10px] text-[var(--muted)]">{ws.entryCount}</span>
                </button>
                <div className="flex items-center opacity-70 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  {onTogglePinWorkspace && (
                    <button
                      type="button"
                      aria-label={isPinned ? `Unpin ${ws.name}` : `Pin ${ws.name}`}
                      aria-pressed={isPinned}
                      className={cn(
                        "rounded p-1 transition hover:bg-[var(--inset)]",
                        isPinned ? "text-[var(--primary)]" : "text-[var(--muted)]",
                      )}
                      onClick={() => onTogglePinWorkspace(ws.id)}
                    >
                      <Pin className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Rename ${ws.name}`}
                    className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
                    onClick={() => onRenameWorkspace(ws.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={canDelete ? `Delete ${ws.name}` : "Cannot delete the last workspace"}
                    disabled={!canDelete}
                    className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-35"
                    onClick={() => onDeleteWorkspace(ws.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            aria-label="New workspace"
            onClick={onCreateWorkspace}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden />
            New
          </button>
        </div>
        <span className="hidden shrink-0 text-[10px] text-[var(--muted)] sm:inline">
          {active ? `${entryCount} in ${active.name}` : `${entryCount} entries`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="vault-search">
          Search all workspaces
        </label>
        <input
          className="inset-field min-w-[180px] flex-1 px-3 py-2"
          id="vault-search"
          name="vault-search"
          type="search"
          placeholder="Search all workspaces…"
          aria-label="Search all workspaces"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <div
          className="flex rounded-md border border-[var(--border)] p-0.5"
          role="group"
          aria-label="Entry layout"
        >
          <button
            type="button"
            aria-label="List layout"
            aria-pressed={layout === "list"}
            onClick={() => onLayoutChange("list")}
            className={cn(
              "rounded px-2 py-1.5 transition",
              layout === "list"
                ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <LayoutList className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Grid layout"
            aria-pressed={layout === "grid"}
            onClick={() => onLayoutChange("grid")}
            className={cn(
              "rounded px-2 py-1.5 transition",
              layout === "grid"
                ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {onNewFromClipboard && (
          <button type="button" className="btn-ghost" onClick={onNewFromClipboard}>
            From clipboard
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onNewEntry}>
          New entry
        </button>
        <button type="button" className="btn-danger" onClick={onReplace}>
          Replace…
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] tracking-wide text-[var(--muted)] uppercase">Category</span>
          <button
            type="button"
            onClick={() => onCategoryFilter(null)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs transition",
              !categoryFilter
                ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:bg-[var(--accent-wash)]/50",
            )}
          >
            All
          </button>
          {categories.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onCategoryFilter(categoryFilter === tag ? null : tag)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs transition",
                categoryFilter === tag
                  ? "border-[var(--primary)]/40 bg-[var(--accent-wash)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--accent-wash)]/50",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
