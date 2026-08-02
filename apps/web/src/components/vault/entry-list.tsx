"use client";

import { useState } from "react";
import type { EntrySummary, EntryType, ImportResult } from "@/lib/api";
import type { EntryLayout } from "@/components/shell/dashboard-header";
import { EntryIcon } from "@/components/vault/entry-icon";
import { SwipeableRow } from "@/components/vault/swipeable-row";
import { VaultEmptyState } from "@/components/vault/vault-empty-state";
import { useCompactSurface } from "@/lib/use-compact-surface";
import { cn } from "@/lib/utils";

function TypePill({ type }: { type: EntryType }) {
  return (
    <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--muted)] uppercase">
      {type}
    </span>
  );
}

function CategoryChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 4).map((tag) => (
        <span
          key={tag}
          className="rounded bg-[var(--inset)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
        >
          {tag}
        </span>
      ))}
      {tags.length > 4 && (
        <span className="text-[10px] text-[var(--muted)]">+{tags.length - 4}</span>
      )}
    </div>
  );
}

function CopyButtons({
  id,
  copyFlash,
  onCopyLogin,
  onCopyAll,
  onCopyUser,
  onCopyPass,
  compact,
}: {
  id: string;
  copyFlash: string | null;
  onCopyLogin: (id: string) => void;
  onCopyAll: (id: string) => void;
  onCopyUser: (id: string) => void;
  onCopyPass: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "mt-auto pt-2")}>
      <button
        type="button"
        title="Copy username now, then password shortly (login flow)"
        aria-label="Copy login (username then password)"
        className={cn(
          "rounded-md border border-[var(--border)] bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/20",
          "min-h-9 touch-target px-3",
          copyFlash === `${id}:login` && "animate-copy border-[var(--primary)]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCopyLogin(id);
        }}
      >
        Copy
      </button>
      <button
        type="button"
        title="Copy all fields as a labeled block"
        aria-label="Copy all fields"
        className={cn(
          "min-h-9 touch-target rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--inset)]",
          copyFlash === `${id}:all` && "animate-copy border-[var(--primary)]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCopyAll(id);
        }}
      >
        Copy all
      </button>
      <button
        type="button"
        title="Copy username"
        aria-label="Copy username"
        className={cn(
          "min-h-9 touch-target rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--inset)]",
          copyFlash === `${id}:user` && "animate-copy border-[var(--primary)]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCopyUser(id);
        }}
      >
        User
      </button>
      <button
        type="button"
        title="Copy password"
        aria-label="Copy password"
        className={cn(
          "min-h-9 touch-target rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--inset)]",
          copyFlash === `${id}:pass` && "animate-copy border-[var(--primary)]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCopyPass(id);
        }}
      >
        Pass
      </button>
    </div>
  );
}

function CompactCopyMenu({
  entry,
  onClose,
  onCopyLogin,
  onCopyAll,
  onCopyUser,
  onCopyPass,
}: {
  entry: EntrySummary;
  onClose: () => void;
  onCopyLogin: (id: string) => void;
  onCopyAll: (id: string) => void;
  onCopyUser: (id: string) => void;
  onCopyPass: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(15,28,28,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-label={`Copy actions for ${entry.title}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-[var(--foreground)]">{entry.title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Swipe right to copy login · swipe left to open · long-press for this menu
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {(
            [
              ["login", "Copy login (user → pass)", onCopyLogin],
              ["all", "Copy all fields", onCopyAll],
              ["user", "Copy username", onCopyUser],
              ["pass", "Copy password", onCopyPass],
            ] as const
          ).map(([key, label, fn]) => (
            <button
              key={key}
              type="button"
              className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--inset)]"
              onClick={() => {
                fn(entry.id);
                onClose();
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="min-h-11 rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--inset)]"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function EntryList({
  entries,
  selectedId,
  copyFlash,
  layout = "list",
  emptyWorkspace = false,
  onSelect,
  onCopyLogin,
  onCopyAll,
  onCopyUser,
  onCopyPass,
  onNewEntry,
  onImported,
  onError,
  onOpenSettings,
  onReplace,
  workspaceName,
  activeWorkspaceId,
  fetchFavicons = false,
}: {
  entries: EntrySummary[];
  selectedId?: string;
  copyFlash: string | null;
  layout?: EntryLayout;
  emptyWorkspace?: boolean;
  onSelect: (id: string, workspaceId?: string) => void;
  onCopyLogin: (id: string) => void;
  onCopyAll: (id: string) => void;
  onCopyUser: (id: string) => void;
  onCopyPass: (id: string) => void;
  onNewEntry: () => void;
  onImported: (result: ImportResult) => void | Promise<void>;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  onReplace: () => void;
  workspaceName?: string;
  activeWorkspaceId?: string;
  fetchFavicons?: boolean;
}) {
  const compact = useCompactSurface();
  const [menuEntry, setMenuEntry] = useState<EntrySummary | null>(null);

  function foreignWorkspace(e: EntrySummary) {
    if (!e.workspaceName) return null;
    if (e.workspaceId && activeWorkspaceId && e.workspaceId === activeWorkspaceId) return null;
    return e.workspaceName;
  }

  if (emptyWorkspace) {
    return (
      <VaultEmptyState
        onNewEntry={onNewEntry}
        onImported={onImported}
        onError={onError}
        onOpenSettings={onOpenSettings}
        onReplace={onReplace}
        workspaceName={workspaceName}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <div className="grid h-full min-h-[160px] place-items-center p-6 text-sm text-[var(--muted)]">
        No entries match this search or filter.
      </div>
    );
  }

  const menu = menuEntry ? (
    <CompactCopyMenu
      entry={menuEntry}
      onClose={() => setMenuEntry(null)}
      onCopyLogin={onCopyLogin}
      onCopyAll={onCopyAll}
      onCopyUser={onCopyUser}
      onCopyPass={onCopyPass}
    />
  ) : null;

  if (layout === "grid") {
    return (
      <>
        <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((e) => {
            const wsLabel = foreignWorkspace(e);
            const card = (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!compact) onSelect(e.id, e.workspaceId);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onSelect(e.id, e.workspaceId);
                  }
                }}
                className={cn(
                  "flex h-full w-full cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left transition",
                  selectedId === e.id
                    ? "border-[var(--primary)]/45 bg-[var(--accent-wash)]"
                    : "border-[var(--border)] bg-[var(--card)]/50 hover:border-[var(--primary)]/30 hover:bg-[var(--accent-wash)]/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <EntryIcon title={e.title} url={e.url} fetchEnabled={fetchFavicons} />
                    <span className="line-clamp-2 font-medium leading-snug">{e.title}</span>
                  </div>
                  <TypePill type={e.entryType} />
                </div>
                {wsLabel && (
                  <p className="truncate text-[10px] tracking-wide text-[var(--muted)] uppercase">
                    {wsLabel}
                  </p>
                )}
                <p className="truncate text-sm text-[var(--muted)]">
                  {e.username || e.url || "—"}
                </p>
                <CategoryChips tags={e.tags} />
                {!compact && (
                  <CopyButtons
                    id={e.id}
                    copyFlash={copyFlash}
                    onCopyLogin={onCopyLogin}
                    onCopyAll={onCopyAll}
                    onCopyUser={onCopyUser}
                    onCopyPass={onCopyPass}
                    compact
                  />
                )}
                {compact && (
                  <p className="mt-auto pt-2 text-[10px] text-[var(--muted)]">
                    Swipe → copy · ← open · hold for more
                  </p>
                )}
              </div>
            );
            return (
              <li key={`${e.workspaceId ?? "ws"}-${e.id}`}>
                {compact ? (
                  <SwipeableRow
                    className="rounded-lg"
                    onSwipeRight={() => onCopyLogin(e.id)}
                    onSwipeLeft={() => onSelect(e.id, e.workspaceId)}
                    onLongPress={() => setMenuEntry(e)}
                  >
                    {card}
                  </SwipeableRow>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
        {menu}
      </>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[var(--border)]">
        {entries.map((e) => {
          const wsLabel = foreignWorkspace(e);
          const row = (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition min-h-[56px]",
                selectedId === e.id ? "bg-[var(--accent-wash)]" : "hover:bg-[var(--accent-wash)]/40",
              )}
            >
              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 touch-target text-left"
                onClick={() => onSelect(e.id, e.workspaceId)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <EntryIcon
                    title={e.title}
                    url={e.url}
                    fetchEnabled={fetchFavicons}
                    className="h-7 w-7 text-[10px]"
                  />
                  <span className="font-medium">{e.title}</span>
                  <TypePill type={e.entryType} />
                  {wsLabel && (
                    <span className="rounded bg-[var(--inset)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                      {wsLabel}
                    </span>
                  )}
                  <CategoryChips tags={e.tags} />
                </div>
                <p className="truncate text-sm text-[var(--muted)]">
                  {e.username || e.url || "—"}
                </p>
              </button>
              {!compact && (
                <CopyButtons
                  id={e.id}
                  copyFlash={copyFlash}
                  onCopyLogin={onCopyLogin}
                  onCopyAll={onCopyAll}
                  onCopyUser={onCopyUser}
                  onCopyPass={onCopyPass}
                />
              )}
            </div>
          );
          return (
            <li key={`${e.workspaceId ?? "ws"}-${e.id}`}>
              {compact ? (
                <SwipeableRow
                  onSwipeRight={() => onCopyLogin(e.id)}
                  onSwipeLeft={() => onSelect(e.id, e.workspaceId)}
                  onLongPress={() => setMenuEntry(e)}
                >
                  {row}
                </SwipeableRow>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
      {menu}
    </>
  );
}
