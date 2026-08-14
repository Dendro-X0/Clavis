"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EntrySummary, WorkspaceSummary } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  type KeybindingAction,
  formatChord,
  resolveBindings,
} from "@/lib/keybindings";
import { cn } from "@/lib/utils";
import {
  SETTINGS_NAV,
  SETTINGS_SECTION_META,
  type SettingsSectionId,
} from "@/components/shell/settings/types";
import { vaultNavItems, type NavId } from "@/components/shell/sidebar";

export type PaletteActionId =
  | "new-entry"
  | "new-from-clipboard"
  | "recycle-bin"
  | "password-health"
  | "settings"
  | "lock"
  | "focus-search"
  | "toggle-layout";

export type PaletteCopyMode = "login" | "user" | "pass" | "otp";
export type PaletteAutotypeMode = "login" | "username" | "password" | "totp";

type PaletteItem =
  | { kind: "action"; id: PaletteActionId; label: string; hint: string }
  | { kind: "nav"; id: NavId; label: string; hint: string }
  | {
      kind: "settings-section";
      id: SettingsSectionId;
      label: string;
      hint: string;
    }
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
    }
  | {
      kind: "autotype";
      id: string;
      entryId: string;
      mode: PaletteAutotypeMode;
      label: string;
      hint: string;
    };

const ACTION_DEFS: {
  id: PaletteActionId;
  label: string;
  binding?: KeybindingAction;
  searchTerms?: string[];
}[] = [
  { id: "new-entry", label: "New entry", binding: "newEntry" },
  { id: "new-from-clipboard", label: "New from clipboard" },
  { id: "recycle-bin", label: "Open recycle bin", searchTerms: ["trash", "deleted"] },
  { id: "password-health", label: "Password health", searchTerms: ["weak", "breach"] },
  { id: "settings", label: "Open settings", binding: "settings" },
  { id: "lock", label: "Lock vault", binding: "lock" },
  { id: "focus-search", label: "Focus toolbar search", binding: "search" },
  { id: "toggle-layout", label: "Toggle list / grid layout", searchTerms: ["grid", "list"] },
];

const NAV_SEARCH: Record<Exclude<NavId, "settings">, string[]> = {
  all: ["entries", "vault", "home"],
  login: ["logins", "password", "credentials"],
  note: ["notes", "secure note"],
  api: ["api", "token", "keys"],
  custom: ["custom", "other"],
};

function matchesQuery(haystacks: string[], q: string) {
  if (!q) return true;
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

function paletteItemKey(item: PaletteItem): string {
  switch (item.kind) {
    case "action":
      return `action:${item.id}`;
    case "nav":
      return `nav:${item.id}`;
    case "settings-section":
      return `settings:${item.id}`;
    case "workspace":
      return `workspace:${item.id}`;
    case "entry":
      return `entry:${item.id}`;
    case "copy":
      return `copy:${item.entryId}:${item.mode}`;
    case "autotype":
      return `autotype:${item.entryId}:${item.mode}`;
  }
}

function dedupePaletteItems(items: PaletteItem[]): PaletteItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = paletteItemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isChordHint(hint: string): boolean {
  return hint.includes("+") || hint.startsWith("mod");
}

export function CommandPalette({
  open,
  onOpenChange,
  entries,
  workspaces,
  keybindingOverrides,
  compact = false,
  onSelectEntry,
  onSelectWorkspace,
  onSelectSettingsSection,
  onNavigate,
  onCopyEntry,
  onAutotypeEntry,
  autotypeEnabled = false,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: EntrySummary[];
  workspaces: WorkspaceSummary[];
  keybindingOverrides?: Record<string, string> | null;
  compact?: boolean;
  onSelectEntry: (id: string, workspaceId?: string) => void;
  onSelectWorkspace: (id: string) => void;
  onSelectSettingsSection: (id: SettingsSectionId) => void;
  onNavigate: (id: NavId) => void;
  onCopyEntry: (id: string, mode: PaletteCopyMode) => void;
  onAutotypeEntry?: (id: string, mode: PaletteAutotypeMode) => void;
  autotypeEnabled?: boolean;
  onAction: (id: PaletteActionId) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const bindings = resolveBindings(keybindingOverrides);

    const settingsSections = SETTINGS_NAV.filter(
      (section) => !compact || !section.desktopOnly,
    ).filter((section) =>
      matchesQuery(
        [section.label, section.id, "settings", ...section.keywords],
        needle,
      ),
    );

    const suppressGenericSettings =
      needle.length > 0 && settingsSections.length > 0;
    const suppressRecycleAction =
      needle.length > 0 &&
      settingsSections.some((section) => section.id === "recycle-bin");

    const actions: PaletteItem[] = ACTION_DEFS.filter((action) => {
      if (action.id === "settings" && suppressGenericSettings) return false;
      if (action.id === "recycle-bin" && suppressRecycleAction) return false;
      const hint = action.binding ? (bindings[action.binding][0] ?? "") : "";
      return matchesQuery(
        [action.label, action.id, hint, ...(action.searchTerms ?? [])],
        needle,
      );
    }).map((action) => ({
      kind: "action" as const,
      id: action.id,
      label: action.label,
      hint: action.binding ? (bindings[action.binding][0] ?? "") : "",
    }));

    const navItems: PaletteItem[] = vaultNavItems
      .filter((item): item is typeof item & { id: Exclude<NavId, "settings"> } =>
        item.id !== "settings",
      )
      .filter((item) =>
        matchesQuery(
          [item.label, item.id, ...(NAV_SEARCH[item.id] ?? [])],
          needle,
        ),
      )
      .map((item) => ({
        kind: "nav" as const,
        id: item.id,
        label: `Go to ${item.label}`,
        hint: item.id === "all" ? "Vault home" : "Filter by type",
      }));

    const settingsItems: PaletteItem[] = settingsSections.map((section) => ({
      kind: "settings-section" as const,
      id: section.id,
      label: `Settings · ${section.label}`,
      hint: SETTINGS_SECTION_META[section.id]?.description ?? "",
    }));

    const workspaceItems: PaletteItem[] = workspaces
      .filter((w) => matchesQuery([w.name, "workspace", "go to"], needle))
      .slice(0, 12)
      .map((w) => ({
        kind: "workspace" as const,
        id: w.id,
        label: `Go to workspace “${w.name}”`,
        hint: w.active ? "Active" : `${w.entryCount} entries`,
      }));

    const seenEntryIds = new Set<string>();
    const matchedEntries = entries
      .filter((entry) => {
        if (seenEntryIds.has(entry.id)) return false;
        if (
          !matchesQuery(
            [
              entry.title,
              entry.username,
              entry.url,
              entry.workspaceName ?? "",
              ...(entry.tags ?? []),
            ],
            needle,
          )
        ) {
          return false;
        }
        seenEntryIds.add(entry.id);
        return true;
      })
      .slice(0, 20);

    const entryItems: PaletteItem[] = [];
    for (const entry of matchedEntries) {
      entryItems.push({
        kind: "entry",
        id: entry.id,
        label: entry.title,
        hint: [entry.workspaceName, entry.username || entry.url]
          .filter(Boolean)
          .join(" · "),
        workspaceId: entry.workspaceId,
        workspaceName: entry.workspaceName,
      });
      if (needle) {
        entryItems.push(
          {
            kind: "copy",
            id: `${entry.id}:login`,
            entryId: entry.id,
            mode: "login",
            label: `Copy login — ${entry.title}`,
            hint: "Username then password",
          },
          {
            kind: "copy",
            id: `${entry.id}:user`,
            entryId: entry.id,
            mode: "user",
            label: `Copy user — ${entry.title}`,
            hint: entry.username || "Username",
          },
          {
            kind: "copy",
            id: `${entry.id}:pass`,
            entryId: entry.id,
            mode: "pass",
            label: `Copy pass — ${entry.title}`,
            hint: "Password",
          },
        );
        if (entry.hasOtp) {
          entryItems.push({
            kind: "copy",
            id: `${entry.id}:otp`,
            entryId: entry.id,
            mode: "otp",
            label: `Copy TOTP — ${entry.title}`,
            hint: "Authenticator code",
          });
        }
        if (autotypeEnabled && onAutotypeEntry) {
          entryItems.push(
            {
              kind: "autotype",
              id: `${entry.id}:type-login`,
              entryId: entry.id,
              mode: "login",
              label: `Type login — ${entry.title}`,
              hint: "Confirm → focused window",
            },
            {
              kind: "autotype",
              id: `${entry.id}:type-user`,
              entryId: entry.id,
              mode: "username",
              label: `Type user — ${entry.title}`,
              hint: "Confirm → focused window",
            },
            {
              kind: "autotype",
              id: `${entry.id}:type-pass`,
              entryId: entry.id,
              mode: "password",
              label: `Type pass — ${entry.title}`,
              hint: "Confirm → focused window",
            },
          );
          if (entry.hasOtp) {
            entryItems.push({
              kind: "autotype",
              id: `${entry.id}:type-otp`,
              entryId: entry.id,
              mode: "totp",
              label: `Type TOTP — ${entry.title}`,
              hint: "Confirm → focused window",
            });
          }
        }
      }
    }

    return dedupePaletteItems([
      ...actions,
      ...navItems,
      ...settingsItems,
      ...workspaceItems,
      ...entryItems,
    ]);
  }, [
    entries,
    workspaces,
    q,
    autotypeEnabled,
    onAutotypeEntry,
    keybindingOverrides,
    compact,
  ]);

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
    } else if (item.kind === "nav") {
      onNavigate(item.id);
    } else if (item.kind === "settings-section") {
      onSelectSettingsSection(item.id);
    } else if (item.kind === "workspace") {
      onSelectWorkspace(item.id);
    } else if (item.kind === "copy") {
      onCopyEntry(item.entryId, item.mode);
    } else if (item.kind === "autotype") {
      onAutotypeEntry?.(item.entryId, item.mode);
    } else {
      onSelectEntry(item.id, item.workspaceId);
    }
    onOpenChange(false);
  }

  function kindLabel(item: PaletteItem) {
    if (item.kind === "action") return "Action";
    if (item.kind === "nav") return "Navigate";
    if (item.kind === "settings-section") return "Settings";
    if (item.kind === "workspace") return "Workspace";
    if (item.kind === "copy") return "Copy";
    if (item.kind === "autotype") return "Type";
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
            placeholder="Search entries, workspaces, settings…"
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
            <li key={paletteItemKey(item)}>
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
                      {isChordHint(item.hint) ? formatChord(item.hint) : item.hint}
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
