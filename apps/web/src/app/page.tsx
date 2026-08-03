"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gate } from "@/components/gate/gate";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { OnboardingTip } from "@/components/shell/onboarding-tip";
import {
  CommandPalette,
  type PaletteActionId,
} from "@/components/shell/command-palette";
import { ClipboardClearToast } from "@/components/shell/clipboard-clear-toast";
import { AppSidebar, type NavId } from "@/components/shell/sidebar";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { Titlebar } from "@/components/titlebar/titlebar";
import { EntryEditor } from "@/components/vault/entry-editor";
import { EntryList } from "@/components/vault/entry-list";
import {
  EntryPagination,
  normalizePageSize,
  type PageSize,
} from "@/components/vault/entry-pagination";
import {
  api,
  type AppSettings,
  type EntrySummary,
  type EntryType,
  type ImportResult,
  type StatusDto,
  type UpsertEntryInput,
  type WorkspaceSummary,
  normalizeEntry,
} from "@/lib/api";
import { appConfirm, appPrompt } from "@/lib/app-dialogs";
import { copyToClipboard, formatEntryForClipboard } from "@/lib/clipboard";
import { blankEntryForm } from "@/lib/sensitive";
import { useCompactSurface } from "@/lib/use-compact-surface";
import { useTheme } from "next-themes";

function formatImportMessage(result: ImportResult) {
  if (result.replaced) {
    return `Replaced “${result.workspaceName}” with ${result.count} login(s).`;
  }
  return `Imported ${result.count} login(s) into workspace “${result.workspaceName}”.`;
}

function normalizeLayout(value: string | undefined): "list" | "grid" {
  return value === "grid" ? "grid" : "list";
}

export default function HomePage() {
  const { setTheme } = useTheme();
  const compact = useCompactSurface();
  const [boot, setBoot] = useState(true);
  const [status, setStatus] = useState<StatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [allEntries, setAllEntries] = useState<EntrySummary[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [nav, setNav] = useState<NavId>("all");
  const [form, setForm] = useState<UpsertEntryInput | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    autoLockSeconds: 300,
    clipboardClearSeconds: 15,
    biometricUnlock: false,
    theme: "system",
    entryLayout: "list",
    pageSize: 25,
    pinnedWorkspaceIds: [],
    fetchFavicons: false,
    allowNetwork: false,
    lockOnHide: true,
  });
  const [page, setPage] = useState(1);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [clipboardClearEndsAt, setClipboardClearEndsAt] = useState<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshVault = useCallback(async () => {
    const [list, all, ws] = await Promise.all([
      api.listEntries(),
      api.listAllEntries(),
      api.listWorkspaces(),
    ]);
    setEntries(list);
    setAllEntries(all);
    setWorkspaces(ws);
    return { list, all, ws };
  }, []);

  const refreshStatus = useCallback(async () => {
    const s = await api.status();
    setStatus(s);
    if (s.state === "unlocked") {
      await refreshVault();
    } else {
      if (loginCopyTimer.current) {
        clearTimeout(loginCopyTimer.current);
        loginCopyTimer.current = null;
      }
      setEntries([]);
      setAllEntries([]);
      setWorkspaces([]);
      setForm(null);
      setNav("all");
      setCategoryFilter(null);
    }
    setBoot(false);
    return s;
  }, [refreshVault]);

  /** Close editor and cancel pending secret copy timers (call before/with lock). */
  const clearSensitiveUi = useCallback(() => {
    if (loginCopyTimer.current) {
      clearTimeout(loginCopyTimer.current);
      loginCopyTimer.current = null;
    }
    setForm(null);
  }, []);

  async function lockVault() {
    clearSensitiveUi();
    await api.lock();
    await refreshStatus();
  }

  useEffect(() => {
    refreshStatus().catch((e) => {
      setError(String(e));
      setBoot(false);
    });
  }, [refreshStatus]);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setSettings({
          ...s,
          entryLayout: normalizeLayout(s.entryLayout),
          pageSize: normalizePageSize(s.pageSize),
          pinnedWorkspaceIds: s.pinnedWorkspaceIds ?? [],
          fetchFavicons: Boolean(s.fetchFavicons),
          allowNetwork: Boolean(s.allowNetwork),
          lockOnHide: s.lockOnHide !== false,
          clipboardClearSeconds: s.clipboardClearSeconds ?? 15,
        });
        if (s.theme) setTheme(s.theme);
      })
      .catch(() => undefined);
  }, [status?.state, setTheme]);

  useEffect(() => {
    if (status?.state !== "unlocked") {
      setShowOnboarding(false);
      return;
    }
    try {
      setShowOnboarding(localStorage.getItem("clavis_show_onboarding") === "1");
    } catch {
      setShowOnboarding(false);
    }
  }, [status?.state]);

  useEffect(() => {
    const onResize = () => setSidebarCollapsed(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (status?.state !== "unlocked") return;
    const ms = Math.max(30, settings.autoLockSeconds) * 1000;
    idleTimer.current = setTimeout(() => {
      clearSensitiveUi();
      api.lock()
        .then(() => refreshStatus())
        .catch(() => undefined);
    }, ms);
  }, [status?.state, settings.autoLockSeconds, refreshStatus, clearSensitiveUi]);

  useEffect(() => {
    resetIdle();
    const onActivity = () => resetIdle();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    const onVis = () => {
      if (
        document.hidden &&
        status?.state === "unlocked" &&
        settings.lockOnHide !== false
      ) {
        clearSensitiveUi();
        api.lock().then(() => refreshStatus());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVis);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle, status?.state, refreshStatus, clearSensitiveUi, settings.lockOnHide]);

  const activeWorkspace = useMemo(() => workspaces.find((w) => w.active), [workspaces]);

  const categories = useMemo(() => {
    const source = query.trim() ? allEntries : entries;
    const set = new Set<string>();
    for (const e of source) {
      for (const t of e.tags ?? []) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries, allEntries, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? allEntries : entries;
    if (nav !== "all" && nav !== "settings") {
      list = list.filter((e) => e.entryType === (nav as EntryType));
    }
    if (categoryFilter) {
      const needle = categoryFilter.toLowerCase();
      list = list.filter((e) => e.tags.some((t) => t.toLowerCase() === needle));
    }
    if (!q) return list;
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        (e.customFields ?? []).some(
          (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
        ) ||
        (e.workspaceName?.toLowerCase().includes(q) ?? false),
    );
  }, [entries, allEntries, query, nav, categoryFilter]);

  const pageSize = settings.pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, nav, categoryFilter, activeWorkspace?.id, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function copyText(label: string, text: string, opts?: { scheduleClear?: boolean }) {
    if (!text) {
      setError("Nothing to copy for that field.");
      return;
    }
    const scheduleClear = opts?.scheduleClear !== false;
    try {
      await copyToClipboard(text);
      setCopyFlash(label);
      setTimeout(() => setCopyFlash(null), 700);
      if (scheduleClear) {
        if (clipboardClearTimer.current) clearTimeout(clipboardClearTimer.current);
        try {
          const { clear } = await import("@tauri-apps/plugin-clipboard-manager");
          const clearAfter = Math.max(5, settings.clipboardClearSeconds) * 1000;
          setClipboardClearEndsAt(Date.now() + clearAfter);
          clipboardClearTimer.current = setTimeout(() => {
            clear().catch(() => undefined);
            setClipboardClearEndsAt(null);
          }, clearAfter);
        } catch {
          /* browser clipboard has no clear API */
          setClipboardClearEndsAt(null);
        }
      }
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  /** Username now; password replaces clipboard after a short delay (login paste flow). */
  async function copyLoginSequence(id: string) {
    if (loginCopyTimer.current) {
      clearTimeout(loginCopyTimer.current);
      loginCopyTimer.current = null;
    }
    const full = normalizeEntry(await api.getEntry(id));
    const user = full.username.trim();
    let pass = full.password;
    // Drop full entry reference; keep only field locals for the sequence.
    if (!user && !pass) {
      setError("Nothing to copy for that entry.");
      return;
    }
    if (!user) {
      await copyText(`${id}:pass`, pass);
      pass = "";
      setError("Password copied.");
      return;
    }
    // Don't clear yet — password stage still needs the clipboard.
    await copyText(`${id}:login`, user, { scheduleClear: false });
    if (!pass) {
      setError("Username copied (no password on this entry).");
      return;
    }
    const delaySec = Math.min(15, Math.max(5, Math.floor(settings.clipboardClearSeconds / 2) || 8));
    setError(`Username copied. Password copies in ${delaySec}s — paste user, then wait.`);
    const pendingPass = pass;
    pass = "";
    loginCopyTimer.current = setTimeout(() => {
      copyText(`${id}:pass`, pendingPass)
        .then(() => setError("Password copied — paste it now."))
        .catch((e) => setError(String(e)));
      loginCopyTimer.current = null;
    }, delaySec * 1000);
  }

  async function openEntry(id: string, workspaceId?: string) {
    setError(null);
    const targetWs = workspaceId?.trim();
    if (targetWs && targetWs !== activeWorkspace?.id) {
      const list = await api.setActiveWorkspace(targetWs);
      setWorkspaces(list);
      const [entriesList, all] = await Promise.all([api.listEntries(), api.listAllEntries()]);
      setEntries(entriesList);
      setAllEntries(all);
      setCategoryFilter(null);
      setNav("all");
    }
    const raw = await api.getEntry(id);
    const e = normalizeEntry(raw);
    setForm({
      id: e.id,
      entryType: e.entryType,
      title: e.title,
      username: e.username,
      password: e.password,
      url: e.url,
      notes: e.notes,
      tags: e.tags,
      customFields: e.customFields,
    });
  }

  async function handleImported(result: ImportResult) {
    setError(formatImportMessage(result));
    clearSensitiveUi();
    setCategoryFilter(null);
    setNav("all");
    await refreshStatus();
  }

  async function handleReplace() {
    const name = activeWorkspace?.name ?? "this workspace";
    const ok = await appConfirm({
      title: "Replace workspace?",
      description: `Replace all entries in “${name}” with a new import file?`,
      confirmLabel: "Replace",
      danger: true,
    });
    if (!ok) return;
    try {
      const path = await api.pickOpenPath("credentials");
      if (!path) return;
      const result = await api.importCredentialsFile(path, "replace");
      await handleImported(result);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function handleSelectWorkspace(id: string) {
    try {
      setError(null);
      setForm(null);
      setCategoryFilter(null);
      setPage(1);
      const list = await api.setActiveWorkspace(id);
      setWorkspaces(list);
      const [entriesList, all] = await Promise.all([api.listEntries(), api.listAllEntries()]);
      setEntries(entriesList);
      setAllEntries(all);
      setNav("all");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function handleCreateWorkspace() {
    const name = await appPrompt({
      title: "New workspace",
      description: "Create an empty workspace for organizing entries.",
      inputLabel: "Workspace name",
      placeholder: "e.g. Personal",
      confirmLabel: "Create",
    });
    if (!name?.trim()) return;
    try {
      setError(null);
      await api.createWorkspace(name.trim());
      setCategoryFilter(null);
      setPage(1);
      await refreshVault();
      setForm(null);
      setNav("all");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function handleRenameWorkspace(id: string) {
    const target = workspaces.find((w) => w.id === id);
    if (!target) return;
    const name = await appPrompt({
      title: "Rename workspace",
      inputLabel: "Workspace name",
      defaultValue: target.name,
      confirmLabel: "Rename",
    });
    if (!name?.trim() || name.trim() === target.name) return;
    try {
      const list = await api.renameWorkspace(target.id, name.trim());
      setWorkspaces(list);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function handleDeleteWorkspace(id: string) {
    const target = workspaces.find((w) => w.id === id);
    if (!target) return;
    const ok = await appConfirm({
      title: "Delete workspace?",
      description: `Delete workspace “${target.name}” and all of its entries? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      setError(null);
      setForm(null);
      setCategoryFilter(null);
      setPage(1);
      const list = await api.deleteWorkspace(target.id);
      setWorkspaces(list);
      const entriesList = await api.listEntries();
      setEntries(entriesList);
      setNav("all");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function handleLayoutChange(layout: "list" | "grid") {
    const next = { ...settings, entryLayout: layout };
    setSettings(next);
    try {
      await api.saveSettings(next);
    } catch {
      /* keep UI preference even if persist fails */
    }
  }

  async function handlePageSizeChange(size: PageSize) {
    const next = { ...settings, pageSize: size };
    setSettings(next);
    setPage(1);
    try {
      await api.saveSettings(next);
    } catch {
      /* keep UI preference even if persist fails */
    }
  }

  const unlocked = status?.state === "unlocked";

  useEffect(() => {
    if (compact) setSidebarCollapsed(true);
  }, [compact]);

  useEffect(() => {
    if (!unlocked) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (paletteOpen) {
          e.preventDefault();
          setPaletteOpen(false);
          return;
        }
        if (clipboardClearEndsAt != null) {
          e.preventDefault();
          setClipboardClearEndsAt(null);
          return;
        }
        if (form) {
          e.preventDefault();
          setForm(null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (typing && e.key !== "Escape") return;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setPaletteOpen(false);
        document.getElementById("vault-search")?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNav("all");
        setForm({ ...blankEntryForm() });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        lockVault().catch((err) => setError(String(err)));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        clearSensitiveUi();
        setNav("settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, form, refreshStatus, paletteOpen, clipboardClearEndsAt, clearSensitiveUi]);

  function handlePaletteAction(id: PaletteActionId) {
    switch (id) {
      case "new-entry":
        setNav("all");
        setForm({ ...blankEntryForm() });
        break;
      case "settings":
        clearSensitiveUi();
        setNav("settings");
        break;
      case "lock":
        lockVault().catch((err) => setError(String(err)));
        break;
      case "focus-search":
        setNav("all");
        requestAnimationFrame(() => document.getElementById("vault-search")?.focus());
        break;
      case "toggle-layout":
        handleLayoutChange(settings.entryLayout === "grid" ? "list" : "grid").catch(
          () => undefined,
        );
        break;
    }
  }

  return (
    <div className="app-shell" data-compact={compact ? "true" : "false"}>
      <Titlebar compact={compact} />
      <ClipboardClearToast
        endsAt={clipboardClearEndsAt}
        onDismiss={() => setClipboardClearEndsAt(null)}
      />
      {unlocked && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          entries={allEntries}
          workspaces={workspaces}
          onSelectEntry={(id, workspaceId) => {
            openEntry(id, workspaceId).catch((err) => setError(String(err)));
          }}
          onSelectWorkspace={(id) => {
            handleSelectWorkspace(id).catch((err) => setError(String(err)));
          }}
          onCopyEntry={(id, mode) => {
            if (mode === "login") {
              copyLoginSequence(id).catch((err) => setError(String(err)));
            } else if (mode === "user") {
              api
                .getEntry(id)
                .then((raw) => {
                  const user = normalizeEntry(raw).username;
                  return copyText(`${id}:user`, user);
                })
                .catch((err) => setError(String(err)));
            } else {
              api
                .getEntry(id)
                .then((raw) => {
                  const pass = normalizeEntry(raw).password;
                  return copyText(`${id}:pass`, pass);
                })
                .catch((err) => setError(String(err)));
            }
          }}
          onAction={handlePaletteAction}
        />
      )}
      <div className="flex min-h-0 flex-1">
        {unlocked && (
          <AppSidebar
            active={nav}
            collapsed={sidebarCollapsed}
            workspaces={workspaces}
            pinnedWorkspaceIds={settings.pinnedWorkspaceIds ?? []}
            onSelectWorkspace={(id) => {
              handleSelectWorkspace(id).catch((err) => setError(String(err)));
            }}
            onNavigate={(id) => {
              setNav(id);
              if (id === "settings") clearSensitiveUi();
            }}
            onSearch={() => {
              setNav("all");
              setPaletteOpen(true);
            }}
            onLock={() => lockVault()}
          />
        )}

        <main
          className={
            compact
              ? "flex min-w-0 flex-1 flex-col overflow-hidden p-3"
              : "flex min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-5"
          }
        >
          {error && (
            <div
              className={
                error.startsWith("Imported") ||
                error.startsWith("Replaced") ||
                error.startsWith("Username copied") ||
                error.startsWith("Password copied") ||
                error.startsWith("Merged") ||
                error.startsWith("No duplicate") ||
                error.startsWith("Data directory")
                  ? "mb-3 shrink-0 rounded-md border border-[var(--primary)]/35 bg-[var(--accent-wash)] px-4 py-3 text-sm"
                  : "mb-3 shrink-0 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm"
              }
            >
              {error}
            </div>
          )}

          {boot && (
            <div className="grid flex-1 place-items-center text-[var(--muted)]">
              Opening vault…
            </div>
          )}

          {!boot && !unlocked && (
            <div className="grid flex-1 place-items-center">
              <Gate
                status={status}
                onDone={async () => {
                  setError(null);
                  await refreshStatus();
                }}
                onError={setError}
              />
            </div>
          )}

          {!boot && unlocked && nav === "settings" && status && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <SettingsPanel
                status={status}
                settings={settings}
                setSettings={setSettings}
                workspaces={workspaces}
                compact={compact}
                onError={(msg) => setError(msg || null)}
                onImported={async (result) => {
                  if (result) {
                    await handleImported(result);
                  } else {
                    await refreshStatus();
                    setNav("all");
                  }
                }}
                onWorkspacesChanged={async (list) => {
                  setWorkspaces(list);
                  const [entriesList, all] = await Promise.all([
                    api.listEntries(),
                    api.listAllEntries(),
                  ]);
                  setEntries(entriesList);
                  setAllEntries(all);
                  setForm(null);
                  setCategoryFilter(null);
                }}
                onDataDirChanged={async () => {
                  await refreshStatus();
                  setNav("all");
                }}
              />
            </div>
          )}

          {!boot && unlocked && nav !== "settings" && (
            <div className="animate-rise flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
                {showOnboarding && (
                  <OnboardingTip
                    onDismiss={() => {
                      setShowOnboarding(false);
                      try {
                        localStorage.removeItem("clavis_show_onboarding");
                      } catch {
                        /* ignore */
                      }
                    }}
                    onImportHint={() => setNav("settings")}
                  />
                )}
                <DashboardHeader
                  workspaces={workspaces}
                  entryCount={entries.length}
                  query={query}
                  onQueryChange={setQuery}
                  layout={settings.entryLayout}
                  onLayoutChange={(layout) => {
                    handleLayoutChange(layout).catch(() => undefined);
                  }}
                  categoryFilter={categoryFilter}
                  categories={categories}
                  onCategoryFilter={setCategoryFilter}
                  onSelectWorkspace={(id) => {
                    handleSelectWorkspace(id).catch((err) => setError(String(err)));
                  }}
                  onCreateWorkspace={() => {
                    handleCreateWorkspace().catch((err) => setError(String(err)));
                  }}
                  onRenameWorkspace={(id) => {
                    handleRenameWorkspace(id).catch((err) => setError(String(err)));
                  }}
                  onDeleteWorkspace={(id) => {
                    handleDeleteWorkspace(id).catch((err) => setError(String(err)));
                  }}
                  pinnedWorkspaceIds={settings.pinnedWorkspaceIds ?? []}
                  onTogglePinWorkspace={(id) => {
                    const current = settings.pinnedWorkspaceIds ?? [];
                    const next = current.includes(id)
                      ? current.filter((x) => x !== id)
                      : [...current, id];
                    const updated = { ...settings, pinnedWorkspaceIds: next };
                    setSettings(updated);
                    api.saveSettings(updated).catch((err) => setError(String(err)));
                  }}
                  onReplace={() => {
                    handleReplace().catch((err) => setError(String(err)));
                  }}
                  onNewEntry={() => setForm({ ...blankEntryForm() })}
                />
                <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto scroll-region">
                    <EntryList
                      entries={pagedEntries}
                      selectedId={form?.id}
                      copyFlash={copyFlash}
                      layout={settings.entryLayout}
                      emptyWorkspace={!query.trim() && entries.length === 0}
                      activeWorkspaceId={activeWorkspace?.id}
                      workspaceName={activeWorkspace?.name}
                      fetchFavicons={
                        Boolean(settings.fetchFavicons) && Boolean(settings.allowNetwork)
                      }
                      onSelect={(id, workspaceId) =>
                        openEntry(id, workspaceId).catch((err) => setError(String(err)))
                      }
                      onCopyLogin={(id) => {
                        copyLoginSequence(id).catch((err) => setError(String(err)));
                      }}
                      onCopyAll={async (id) => {
                        const full = normalizeEntry(await api.getEntry(id));
                        const block = formatEntryForClipboard(full);
                        await copyText(`${id}:all`, block);
                      }}
                      onCopyUser={async (id) => {
                        const user = normalizeEntry(await api.getEntry(id)).username;
                        await copyText(`${id}:user`, user);
                      }}
                      onCopyPass={async (id) => {
                        const pass = normalizeEntry(await api.getEntry(id)).password;
                        await copyText(`${id}:pass`, pass);
                      }}
                      onNewEntry={() => setForm({ ...blankEntryForm() })}
                      onOpenSettings={() => {
                        clearSensitiveUi();
                        setNav("settings");
                      }}
                      onReplace={() => {
                        handleReplace().catch((err) => setError(String(err)));
                      }}
                      onImported={handleImported}
                      onError={(msg) => setError(msg)}
                    />
                  </div>
                  {filtered.length > 0 && (
                    <EntryPagination
                      total={filtered.length}
                      page={safePage}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        handlePageSizeChange(size).catch(() => undefined);
                      }}
                    />
                  )}
                </div>
              </div>

              {form && (
                <div className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-full lg:w-[400px] xl:w-[440px]">
                  <EntryEditor
                    form={form}
                    onChange={(updater) => setForm((f) => (f ? updater(f) : f))}
                    onClose={() => clearSensitiveUi()}
                    onSave={async () => {
                      setError(null);
                      await api.upsertEntry(form);
                      await refreshStatus();
                      clearSensitiveUi();
                    }}
                    onDelete={
                      form.id
                        ? async () => {
                            await api.deleteEntry(form.id!);
                            await refreshStatus();
                            clearSensitiveUi();
                          }
                        : undefined
                    }
                    onGenerate={async () => {
                      const password = await api.generatePassword(20);
                      setForm((f) => (f ? { ...f, password } : f));
                    }}
                    onCopy={async () => {
                      try {
                        const { clear } = await import("@tauri-apps/plugin-clipboard-manager");
                        const clearAfter = Math.max(5, settings.clipboardClearSeconds) * 1000;
                        setTimeout(() => {
                          clear().catch(() => undefined);
                        }, clearAfter);
                      } catch {
                        /* browser clipboard has no clear API */
                      }
                    }}
                    onError={setError}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
