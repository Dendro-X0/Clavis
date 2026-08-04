"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EntrySummary, WorkspaceSummary } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PaletteActionId =
  | "new-entry"
  | "settings"
  | "lock"
  | "focus-search"
  | "toggle-layout";

export type PaletteCopyMode = "login" | "user" | "pass" | "otp";

type PaletteItem =
  | { kind: "action"; id: PaletteActionId; label: string; hint: string }
  | {
      kind: "workspace";
      id: string;
      label: string;
      hint: string;
    }
  | {
      kind: "entry";
      id: string;
      label: string;
      hint: string;
      workspaceId?: string;
      workspaceName?: string;
    }
  | {
      kind: "copy";
      id: string;
      entryId: string;
      mode: PaletteCopyMode;
      label: string;
      hint: string;
    };

const ACTIONS: Extract<PaletteItem, { kind: "action" }>[] = [
  { kind: "action", id: "new-entry", label: "New entry", hint: "Ctrl/Cmd+N" },
  { kind: "action", id: "settings", label: "Open settings", hint: "Ctrl/Cmd+," },
  { kind: "action", id: "lock", label: "Lock vault", hint: "Ctrl/Cmd+L" },
  { kind: "action", id: "focus-search", label: "Focus toolbar search", hint: "/" },
  { kind: "action", id: "toggle-layout", label: "Toggle list / grid layout", hint: "" },
];

function matchesQuery(haystacks: string[], q: string) {
  if (!q) return true;
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

export function CommandPalette({
  open,
  onOpenChange,
  entries,
  workspaces,
  onSelectEntry,
  onSelectWorkspace,
  onCopyEntry,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: EntrySummary[];
  workspaces: WorkspaceSummary[];
  onSelectEntry: (id: string, workspaceId?: string) => void;
  onSelectWorkspace: (id: string) => void;
  onCopyEntry: (id: string, mode: PaletteCopyMode) => void;
  onAction: (id: PaletteActionId) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const actions = ACTIONS.filter((a) =>
      matchesQuery([a.label, a.id, a.hint], needle),
    );

    const workspaceItems: PaletteItem[] = workspaces
      .filter((w) => matchesQuery([w.name, "workspace", "go to"], needle))
      .slice(0, 12)
      .map((w) => ({
        kind: "workspace" as const,
        id: w.id,
        label: `Go to workspace “${w.name}”`,
        hint: w.active ? "Active" : `${w.entryCount} entries`,
      }));

    const matchedEntries = entries
      .filter((e) =>
        matchesQuery(
          [e.title, e.username, e.url, e.workspaceName ?? "", ...(e.tags ?? [])],
          needle,
        ),
      )
      .slice(0, 20);

    const entryItems: PaletteItem[] = [];
    for (const e of matchedEntries) {
      entryItems.push({
        kind: "entry",
        id: e.id,
        label: e.title,
        hint: [e.workspaceName, e.username || e.url].filter(Boolean).join(" · "),
        workspaceId: e.workspaceId,
        workspaceName: e.workspaceName,
      });
      if (needle) {
        entryItems.push(
          {
            kind: "copy",
            id: `${e.id}:login`,
            entryId: e.id,
            mode: "login",
            label: `Copy login — ${e.title}`,
            hint: "Username then password",
          },
          {
            kind: "copy",
            id: `${e.id}:user`,
            entryId: e.id,
            mode: "user",
            label: `Copy user — ${e.title}`,
            hint: e.username || "Username",
          },
          {
            kind: "copy",
            id: `${e.id}:pass`,
            entryId: e.id,
            mode: "pass",
            label: `Copy pass — ${e.title}`,
            hint: "Password",
          },
        );
        if (e.hasOtp) {
          entryItems.push({
            kind: "copy",
            id: `${e.id}:otp`,
            entryId: e.id,
            mode: "otp",
            label: `Copy TOTP — ${e.title}`,
            hint: "Authenticator code",
          });
        }
      }
    }

    return [...actions, ...workspaceItems, ...entryItems];
  }, [entries, workspaces, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  function runItem(item: PaletteItem) {
    if (item.kind === "action") {
      onAction(item.id);
    } else if (item.kind === "workspace") {
      onSelectWorkspace(item.id);
    } else if (item.kind === "copy") {
      onCopyEntry(item.entryId, item.mode);
    } else {
      onSelectEntry(item.id, item.workspaceId);
    }
    onOpenChange(false);
  }

  function kindLabel(item: PaletteItem) {
    if (item.kind === "action") return "Action";
    if (item.kind === "workspace") return "Workspace";
    if (item.kind === "copy") return "Copy";
    return "Entry";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="w-[min(100%-1.5rem,520px)] gap-0 overflow-hidden p-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const item = items[active];
            if (item) runItem(item);
          }
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="border-b border-[var(--border)] px-3 py-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entries, workspaces, copy…"
            className="inset-field w-full border-0 bg-transparent px-2 py-2 text-sm shadow-none"
            aria-label="Command palette search"
          />
        </div>
        <ul
          className="max-h-[min(60vh,360px)] overflow-y-auto scroll-region p-1"
          role="listbox"
          aria-label="Commands and entries"
        >
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
              No matches
            </li>
          )}
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition",
                  index === active
                    ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--inset)]",
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => runItem(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.hint && (
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                      {item.hint}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] tracking-wide text-[var(--muted)] uppercase">
                  {kindLabel(item)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted)]">
          ↑↓ navigate · Enter select · Esc close · type to copy credentials
        </p>
      </DialogContent>
    </Dialog>
  );
}
