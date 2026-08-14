"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AppSettings, type ImportResult, type StatusDto, type VaultCryptoInfo, type WorkspaceSummary } from "@/lib/api";
import { SettingsSectionContent, SETTINGS_PERSIST_SECTIONS } from "./settings/settings-sections";
import { SettingsSidebar } from "./settings/settings-sidebar";
import { SETTINGS_NAV, type SettingsSectionId } from "./settings/types";

export function SettingsPanel({
  status,
  settings,
  setSettings,
  workspaces,
  onError,
  onImported,
  onWorkspacesChanged,
  onDataDirChanged,
  onOpenShortcutsHelp,
  compact = false,
  activeSection,
  onActiveSectionChange,
}: {
  status: StatusDto;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  workspaces: WorkspaceSummary[];
  onError: (e: string) => void;
  onImported: (result?: ImportResult) => Promise<void>;
  onWorkspacesChanged: (list: WorkspaceSummary[]) => void | Promise<void>;
  onDataDirChanged?: () => void | Promise<void>;
  onOpenShortcutsHelp?: () => void;
  compact?: boolean;
  /** Controlled settings section (URL / parent sync). */
  activeSection?: SettingsSectionId;
  onActiveSectionChange?: (id: SettingsSectionId) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [internalActive, setInternalActive] = useState<SettingsSectionId>("appearance");
  const active = activeSection ?? internalActive;
  const setActive = onActiveSectionChange ?? setInternalActive;
  const [searchQuery, setSearchQuery] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [importPw, setImportPw] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [dataPortable, setDataPortable] = useState(true);
  const [bioPassword, setBioPassword] = useState("");
  const [bioPersistedOn, setBioPersistedOn] = useState(settings.biometricUnlock);
  const [cryptoInfo, setCryptoInfo] = useState<VaultCryptoInfo | null>(null);
  const [defaultKdf, setDefaultKdf] = useState<VaultCryptoInfo | null>(null);
  const [importPeek, setImportPeek] = useState<VaultCryptoInfo | null>(null);
  const activeWorkspace = workspaces.find((w) => w.active);

  const visibleIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SETTINGS_NAV.filter((item) => {
      if (compact && item.desktopOnly) return false;
      if (!q) return true;
      if (item.label.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    }).map((item) => item.id);
  }, [compact, searchQuery]);

  useEffect(() => {
    if (visibleIds.length > 0 && !visibleIds.includes(active)) {
      setActive(visibleIds[0]!);
    }
  }, [visibleIds, active]);

  useEffect(() => {
    return () => {
      setCurrentPw("");
      setNewPw("");
      setImportPw("");
      setBioPassword("");
    };
  }, []);

  useEffect(() => {
    api
      .getDataDirInfo()
      .then((info) => setDataPortable(info.portable))
      .catch(() => undefined);
  }, [status.dataDir]);

  useEffect(() => {
    api
      .vaultCryptoInfo()
      .then(setCryptoInfo)
      .catch(() => setCryptoInfo(null));
    api
      .defaultVaultKdf()
      .then(setDefaultKdf)
      .catch(() => undefined);
  }, [status.state, status.entryCount]);

  const savePreferences = useCallback(async () => {
    setSaveBusy(true);
    try {
      if (settings.biometricUnlock && !bioPassword.trim() && !bioPersistedOn) {
        throw new Error(
          "Enter your master password to enable convenience unlock, then save again.",
        );
      }
      await api.saveSettings(settings);
      if (settings.biometricUnlock) {
        if (bioPassword.trim()) {
          await api.storeKeyringSecret(bioPassword);
          setBioPassword("");
        }
        setBioPersistedOn(true);
      } else {
        await api.clearKeyringSecret().catch(() => undefined);
        setBioPassword("");
        setBioPersistedOn(false);
      }
      onError("");
    } catch (e) {
      onError(String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [settings, bioPassword, bioPersistedOn, onError]);

  const sectionProps = {
    active,
    status,
    settings,
    setSettings,
    compact,
    dataPortable,
    setDataPortable,
    theme,
    setTheme,
    bioPassword,
    setBioPassword,
    bioPersistedOn,
    cryptoInfo,
    setCryptoInfo,
    defaultKdf,
    importPeek,
    setImportPeek,
    currentPw,
    setCurrentPw,
    newPw,
    setNewPw,
    importPw,
    setImportPw,
    renameValue,
    setRenameValue,
    workspaces,
    activeWorkspace,
    onError,
    onImported,
    onWorkspacesChanged,
    onDataDirChanged,
    onOpenShortcutsHelp,
  };

  return (
    <section className="panel settings-shell flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden lg:flex-row">
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3 lg:hidden">
        <h1 className="settings-section-title">Settings</h1>
        <input
          type="search"
          placeholder="Search settings…"
          className="inset-field mt-3 h-9 w-full px-3 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label className="mt-2 block text-sm">
          <span className="sr-only">Jump to section</span>
          <select
            className="inset-field h-9 w-full px-3"
            value={active}
            onChange={(e) => setActive(e.target.value as SettingsSectionId)}
          >
            {visibleIds.map((id) => {
              const item = SETTINGS_NAV.find((n) => n.id === id);
              return (
                <option key={id} value={id}>
                  {item?.label ?? id}
                </option>
              );
            })}
          </select>
        </label>
        {SETTINGS_PERSIST_SECTIONS.has(active) && (
          <button
            type="button"
            className="btn-primary mt-3 w-full disabled:cursor-not-allowed"
            disabled={saveBusy}
            onClick={() => void savePreferences()}
          >
            {saveBusy ? "Saving…" : "Save preferences"}
          </button>
        )}
      </div>

      <div className="settings-nav-column hidden min-h-0 shrink-0 flex-col border-[var(--border)] lg:flex lg:border-r">
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-4 xl:px-4 xl:py-5">
          <h1 className="settings-section-title">Settings</h1>
          <p className="mt-2 truncate font-mono text-[10px] text-[var(--muted)]" title={status.dataDir}>
            {status.dataDir}
          </p>
        </div>
        <SettingsSidebar
          active={active}
          onSelect={setActive}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          compact={compact}
          showSave={SETTINGS_PERSIST_SECTIONS.has(active)}
          onSave={() => void savePreferences()}
          saveBusy={saveBusy}
        />
      </div>

      <SettingsSectionContent {...sectionProps} />
    </section>
  );
}
