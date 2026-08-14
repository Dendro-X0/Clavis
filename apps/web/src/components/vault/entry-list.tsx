"use client";

import { useEffect, useState } from "react";
import type { EntrySummary, EntryType, ImportResult } from "@/lib/api";
import type { EntryLayout } from "@/components/shell/dashboard-header";
import { EntryIcon } from "@/components/vault/entry-icon";
import { SwipeableRow } from "@/components/vault/swipeable-row";
import { VaultEmptyState } from "@/components/vault/vault-empty-state";
import { ModalShell } from "@/components/ui/modal-shell";
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
  hasOtp,
  copyFlash,
  onCopyLogin,
  onCopyAll,
  onCopyUser,
  onCopyPass,
  onCopyOtp,
  compact,
}: {
  id: string;
  hasOtp?: boolean;
  copyFlash: string | null;
  onCopyLogin: (id: string) => void;
  onCopyAll: (id: string) => void;
  onCopyUser: (id: string) => void;
  onCopyPass: (id: string) => void;
  onCopyOtp?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "mt-auto pt-2")}>
      <button
        type="button"
        title="Copy username now, then password (and TOTP if set)"
        aria-label="Copy login (username then password)"
        className={cn(
          "btn-ghost-sm min-h-9 touch-target border-transparent bg-[var(--primary)]/10 px-3 font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/20",
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
          "btn-ghost-sm min-h-9 touch-target px-3",
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
          "btn-ghost-sm min-h-9 touch-target px-3",
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
          "btn-ghost-sm min-h-9 touch-target px-3",
          copyFlash === `${id}:pass` && "animate-copy border-[var(--primary)]",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCopyPass(id);
        }}
      >
        Pass
      </button>
      {hasOtp && onCopyOtp && (
        <button
          type="button"
          title="Copy current TOTP code"
          aria-label="Copy TOTP code"
          className={cn(
            "btn-ghost-sm min-h-9 touch-target px-3",
            copyFlash === `${id}:otp` && "animate-copy border-[var(--primary)]",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onCopyOtp(id);
          }}
        >
          Code
        </button>
      )}
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
  onCopyOtp,
}: {
  entry: EntrySummary;
  onClose: () => void;
  onCopyLogin: (id: string) => void;
  onCopyAll: (id: string) => void;
  onCopyUser: (id: string) => void;
  onCopyPass: (id: string) => void;
  onCopyOtp?: (id: string) => void;
}) {
  const actions: [string, string, (id: string) => void][] = [
    ["login", "Copy login (user → pass → TOTP)", onCopyLogin],
    ["all", "Copy all fields", onCopyAll],
    ["user", "Copy username", onCopyUser],
    ["pass", "Copy password", onCopyPass],
  ];
  if (entry.hasOtp && onCopyOtp) {
    actions.push(["otp", "Copy TOTP code", onCopyOtp]);
  }
  return (
    <ModalShell
      open
      onClose={onClose}
      label={`Copy actions for ${entry.title}`}
      panelClassName="max-w-sm"
    >
      <div className="p-4">
        <p className="font-medium text-[var(--foreground)]">{entry.title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Swipe right to copy login · swipe left to open · long-press for this menu
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {actions.map(([key, label, fn]) => (
            <button
              key={key}
              type="button"
              className="btn-ghost min-h-11 text-left"
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
            className="min-h-11 rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface)]"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
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
  onCopyOtp,
  onNewEntry,
  onNewFromClipboard,
  onImported,
  onError,
  onOpenSettings,
  onReplace,
  workspaceName,
  activeWorkspaceId,
  noWorkspaces,
  listFocusId,
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
  onCopyOtp?: (id: string) => void;
  onNewEntry: () => void;
  onNewFromClipboard?: () => void;
  onImported: (result: ImportResult) => void | Promise<void>;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  onReplace: () => void;
  workspaceName?: string;
  activeWorkspaceId?: string;
  noWorkspaces?: boolean;
  /** Keyboard list focus (distinct from editor selection). */
  listFocusId?: string | null;
  fetchFavicons?: boolean;
}) {
  const compact = useCompactSurface();
  const [menuEntry, setMenuEntry] = useState<EntrySummary | null>(null);

  useEffect(() => {
    if (!listFocusId) return;
    const el = document.querySelector(`[data-list-focus="true"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [listFocusId]);

  function foreignWorkspace(e: EntrySummary) {
    if (!e.workspaceName) return null;
    if (e.workspaceId && activeWorkspaceId && e.workspaceId === activeWorkspaceId) return null;
    return e.workspaceName;
  }

  if (emptyWorkspace) {
    return (
      <VaultEmptyState
        onNewEntry={onNewEntry}
        onNewFromClipboard={onNewFromClipboard}
        onImported={onImported}
        onError={onError}
        onOpenSettings={onOpenSettings}
        onReplace={onReplace}
        noWorkspaces={noWorkspaces}
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
      onCopyOtp={onCopyOtp}
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
                data-list-focus={listFocusId === e.id ? "true" : undefined}
                className={cn(
                  "entry-card-virtual flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition",
                  selectedId === e.id
                    ? "border-[var(--primary)]/45 bg-[var(--accent-wash)]"
                    : "border-[var(--border)] bg-[var(--card)]/50 hover:border-[var(--primary)]/30 hover:bg-[var(--accent-wash)]/40",
                  listFocusId === e.id && "ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--background)]",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-2 text-left"
                  aria-label={`Open ${e.title || "entry"}`}
                  onClick={() => onSelect(e.id, e.workspaceId)}
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
                  {compact && (
                    <p className="mt-auto pt-2 text-[10px] text-[var(--muted)]">
                      Swipe → copy · ← open · hold for more
                    </p>
                  )}
                </button>
                {!compact && (
                  <CopyButtons
                    id={e.id}
                    hasOtp={e.hasOtp}
                    copyFlash={copyFlash}
                    onCopyLogin={onCopyLogin}
                    onCopyAll={onCopyAll}
                    onCopyUser={onCopyUser}
                    onCopyPass={onCopyPass}
                    onCopyOtp={onCopyOtp}
                    compact
                  />
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
              data-list-focus={listFocusId === e.id ? "true" : undefined}
              className={cn(
                "entry-row-virtual flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition min-h-[56px]",
                selectedId === e.id ? "bg-[var(--accent-wash)]" : "hover:bg-[var(--accent-wash)]/40",
                listFocusId === e.id && "ring-2 ring-inset ring-[var(--ring)]",
              )}
            >
              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 touch-target text-left"
                aria-label={`Open ${e.title || "entry"}`}
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
                  hasOtp={e.hasOtp}
                  copyFlash={copyFlash}
                  onCopyLogin={onCopyLogin}
                  onCopyAll={onCopyAll}
                  onCopyUser={onCopyUser}
                  onCopyPass={onCopyPass}
                  onCopyOtp={onCopyOtp}
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
