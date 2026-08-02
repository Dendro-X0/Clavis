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
}) {
  const active = workspaces.find((w) => w.active);
  const canDelete = workspaces.length > 1;
  const pinned = new Set(pinnedWorkspaceIds);

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">Workspaces</p>
        <span className="text-[10px] text-[var(--muted)]">
          {active ? `${entryCount} in ${active.name}` : `${entryCount} entries`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {workspaces.map((ws) => {
          const isPinned = pinned.has(ws.id);
          return (
          <div
            key={ws.id}
            role="button"
            tabIndex={0}
            aria-pressed={ws.active}
            title={ws.name}
            onClick={() => onSelectWorkspace(ws.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectWorkspace(ws.id);
              }
            }}
            className={cn(
              "group flex min-h-[88px] cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition",
              ws.active
                ? "border-[var(--primary)]/45 bg-[var(--accent-wash)] shadow-[inset_0_0_0_1px_rgba(42,143,131,0.12)]"
                : "border-[var(--border)] bg-[var(--card)]/55 hover:border-[var(--primary)]/30 hover:bg-[var(--accent-wash)]/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--foreground)]">{ws.name}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {ws.entryCount} {ws.entryCount === 1 ? "entry" : "entries"}
                  {ws.active ? " · active" : ""}
                  {isPinned ? " · pinned" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {onTogglePinWorkspace && (
                  <button
                    type="button"
                    title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
                    aria-pressed={isPinned}
                    className={cn(
                      "rounded-md border border-[var(--border)] p-1.5 transition hover:bg-[var(--inset)]",
                      isPinned
                        ? "text-[var(--primary)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinWorkspace(ws.id);
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="Rename workspace"
                  className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameWorkspace(ws.id);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={canDelete ? "Delete workspace" : "Cannot delete the last workspace"}
                  disabled={!canDelete}
                  className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-35"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWorkspace(ws.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {ws.sourceFile ? (
              <p className="truncate text-[10px] text-[var(--muted)]" title={ws.sourceFile}>
                From {ws.sourceFile}
              </p>
            ) : (
              <p className="text-[10px] text-[var(--muted)]">Manual workspace</p>
            )}
          </div>
          );
        })}

        <button
          type="button"
          title="New workspace"
          onClick={onCreateWorkspace}
          className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-3 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--accent-wash)]/30 hover:text-[var(--foreground)]"
        >
          <FolderPlus className="h-5 w-5" />
          <span>New workspace</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="inset-field min-w-[180px] flex-1 px-3 py-2"
          id="vault-search"
          placeholder="Search all workspaces… (/)"
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
            title="List layout"
            aria-pressed={layout === "list"}
            onClick={() => onLayoutChange("list")}
            className={cn(
              "rounded px-2 py-1.5 transition",
              layout === "list"
                ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Grid layout"
            aria-pressed={layout === "grid"}
            onClick={() => onLayoutChange("grid")}
            className={cn(
              "rounded px-2 py-1.5 transition",
              layout === "grid"
                ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--inset)]"
          onClick={onReplace}
        >
          Replace
        </button>
        <button
          type="button"
          className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-fg)] hover:opacity-90"
          onClick={onNewEntry}
        >
          New entry
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
