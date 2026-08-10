"use client";

import {
  FileKey2,
  Folder,
  HeartPulse,
  KeyRound,
  Lock,
  NotebookPen,
  Pin,
  Search,
  Settings,
  Shield,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { EntryType, WorkspaceSummary } from "@/lib/api";

export type NavId = "all" | EntryType | "settings";

const vaultItems: { id: NavId; label: string; icon: typeof Shield }[] = [
  { id: "all", label: "All entries", icon: Shield },
  { id: "login", label: "Logins", icon: KeyRound },
  { id: "note", label: "Notes", icon: StickyNote },
  { id: "api", label: "API / tokens", icon: FileKey2 },
  { id: "custom", label: "Custom", icon: NotebookPen },
];

function useModKeyHint() {
  const [hint, setHint] = useState("Ctrl+K");
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac");
    setHint(mac ? "⌘K" : "Ctrl+K");
  }, []);
  return hint;
}

export function AppSidebar({
  active,
  onNavigate,
  onLock,
  onSearch,
  onOpenTrash,
  onOpenHealth,
  trashCount,
  workspaces,
  pinnedWorkspaceIds,
  onSelectWorkspace,
  collapsed,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onLock: () => void;
  onSearch?: () => void;
  onOpenTrash?: () => void;
  onOpenHealth?: () => void;
  trashCount?: number;
  workspaces?: WorkspaceSummary[];
  pinnedWorkspaceIds?: string[];
  onSelectWorkspace?: (id: string) => void;
  collapsed?: boolean;
}) {
  const modHint = useModKeyHint();

  const pinnedList = useMemo(() => {
    if (!workspaces?.length) return [];
    const pinned = new Set(pinnedWorkspaceIds ?? []);
    const activeWs = workspaces.find((w) => w.active);
    const fromPins = workspaces.filter((w) => pinned.has(w.id));
    if (activeWs && !fromPins.some((w) => w.id === activeWs.id)) {
      return [activeWs, ...fromPins];
    }
    return fromPins;
  }, [workspaces, pinnedWorkspaceIds]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar)] py-3 transition-[width]",
        collapsed ? "w-14 sm:w-16" : "w-[min(13.75rem,28vw)] min-w-[11.5rem] max-w-[14rem]",
      )}
    >
      <p
        className={cn(
          "px-4 pb-2 text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase",
          collapsed && "sr-only",
        )}
      >
        Vault
      </p>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scroll-region px-2">
        {onSearch && (
          <button
            type="button"
            title={`Search (${modHint})`}
            aria-label={`Search (${modHint})`}
            onClick={onSearch}
            className={cn(
              "mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
              collapsed && "justify-center px-0",
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Search</span>
                <kbd className="rounded border border-[var(--border)] px-1 text-[10px] text-[var(--muted)]">
                  {modHint}
                </kbd>
              </span>
            )}
          </button>
        )}
        {vaultItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                isActive
                  ? "bg-[var(--accent-wash)] text-[var(--foreground)] shadow-[inset_2px_0_0_0_var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {onSelectWorkspace && pinnedList.length > 0 && (
          <>
            <p
              className={cn(
                "mt-3 px-2.5 pb-1 text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase",
                collapsed && "sr-only",
              )}
            >
              Workspaces
            </p>
            {pinnedList.map((ws) => (
              <button
                key={ws.id}
                type="button"
                title={ws.name}
                aria-label={`${ws.name}${ws.active ? ", active workspace" : ""}`}
                aria-current={ws.active ? "true" : undefined}
                onClick={() => onSelectWorkspace(ws.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                  ws.active
                    ? "bg-[var(--accent-wash)] text-[var(--foreground)] shadow-[inset_2px_0_0_0_var(--primary)]"
                    : "text-[var(--muted)] hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
                  collapsed && "justify-center px-0",
                )}
              >
                {ws.active || (pinnedWorkspaceIds ?? []).includes(ws.id) ? (
                  <Pin className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Folder className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {!collapsed && <span className="truncate">{ws.name}</span>}
              </button>
            ))}
          </>
        )}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--border)] px-2 pt-2">
        {onOpenHealth && (
          <button
            type="button"
            title="Password health"
            aria-label="Password health"
            onClick={onOpenHealth}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
              collapsed && "justify-center px-0",
            )}
          >
            <HeartPulse className="h-4 w-4" aria-hidden />
            {!collapsed && <span>Password health</span>}
          </button>
        )}
        {onOpenTrash && (
          <button
            type="button"
            title="Recycle bin"
            aria-label={
              trashCount != null && trashCount > 0
                ? `Recycle bin, ${trashCount} items`
                : "Recycle bin"
            }
            onClick={onOpenTrash}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
              collapsed && "justify-center px-0",
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {!collapsed && (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Recycle bin</span>
                {trashCount != null && trashCount > 0 && (
                  <span className="rounded-full bg-[var(--inset)] px-1.5 text-[10px] tabular-nums">
                    {trashCount}
                  </span>
                )}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
            active === "settings"
              ? "bg-[var(--accent-wash)] text-[var(--foreground)] shadow-[inset_2px_0_0_0_var(--primary)]"
              : "text-[var(--muted)] hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
            collapsed && "justify-center px-0",
          )}
        >
          <Settings className="h-4 w-4" aria-hidden />
          {!collapsed && <span>Settings</span>}
        </button>
        <button
          type="button"
          title="Lock"
          aria-label="Lock vault"
          onClick={onLock}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-wash)]/60 hover:text-[var(--foreground)]",
            collapsed && "justify-center px-0",
          )}
        >
          <Lock className="h-4 w-4" aria-hidden />
          {!collapsed && <span>Lock</span>}
        </button>
      </div>
    </aside>
  );
}
