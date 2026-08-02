"use client";

import type { EntrySummary, EntryType, ImportResult } from "@/lib/api";
import type { EntryLayout } from "@/components/shell/dashboard-header";
import { VaultEmptyState } from "@/components/vault/vault-empty-state";
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
          "rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)]",
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
          "rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)]",
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
          "rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)]",
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
}: {
  entries: EntrySummary[];
  selectedId?: string;
  copyFlash: string | null;
  layout?: EntryLayout;
  /** True when the active workspace has no entries at all (vs filter miss). */
  emptyWorkspace?: boolean;
  onSelect: (id: string) => void;
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
}) {
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

  if (layout === "grid") {
    return (
      <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => (
          <li key={e.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(e.id)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onSelect(e.id);
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
                <span className="line-clamp-2 font-medium leading-snug">{e.title}</span>
                <TypePill type={e.entryType} />
              </div>
              <p className="truncate text-sm text-[var(--muted)]">
                {e.username || e.url || "—"}
              </p>
              <CategoryChips tags={e.tags} />
              <CopyButtons
                id={e.id}
                copyFlash={copyFlash}
                onCopyLogin={onCopyLogin}
                onCopyAll={onCopyAll}
                onCopyUser={onCopyUser}
                onCopyPass={onCopyPass}
                compact
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {entries.map((e) => (
        <li
          key={e.id}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition",
            selectedId === e.id ? "bg-[var(--accent-wash)]" : "hover:bg-[var(--accent-wash)]/40",
          )}
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onSelect(e.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{e.title}</span>
              <TypePill type={e.entryType} />
              <CategoryChips tags={e.tags} />
            </div>
            <p className="truncate text-sm text-[var(--muted)]">
              {e.username || e.url || "—"}
            </p>
          </button>
          <CopyButtons
            id={e.id}
            copyFlash={copyFlash}
            onCopyLogin={onCopyLogin}
            onCopyAll={onCopyAll}
            onCopyUser={onCopyUser}
            onCopyPass={onCopyPass}
          />
        </li>
      ))}
    </ul>
  );
}
