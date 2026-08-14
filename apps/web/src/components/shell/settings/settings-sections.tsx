"use client";

import { FileDropZone } from "@/components/import/file-drop-zone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type AppSettings,
  type SnapshotInfo,
  type StatusDto,
  type VaultCryptoInfo,
  type WorkspaceSummary,
  formatVaultCryptoInfo,
  isWeakerThanDefaults,
  normalizeEntryLayout,
  normalizeTheme,
} from "@/lib/api";
import { applyDocumentSkin, normalizeSkin, SKIN_IDS, SKIN_LABELS } from "@/lib/skin";
import { importCredentialsFileSmart } from "@/lib/import";
import { appConfirm, appPrompt } from "@/lib/app-dialogs";
import { PageSizeRow } from "@/components/vault/page-size-row";
import { SettingsCard, SettingsField } from "./settings-ui";
import { useEffect, useState } from "react";
import { SETTINGS_SECTION_META, type SettingsSectionId } from "./types";
import {
  KEYBINDING_GROUPS,
  KEYBINDING_LABELS,
  eventToChord,
  findConflict,
  formatChords,
  resolveBindings,
  type KeybindingAction,
} from "@/lib/keybindings";

function formatImportMessage(result: {
  count: number;
  workspaceName: string;
  replaced: boolean;
}) {
  if (result.replaced) {
    return `Replaced “${result.workspaceName}” with ${result.count} login(s).`;
  }
  return `Imported ${result.count} login(s) into workspace “${result.workspaceName}”.`;
}

export type SettingsSectionsProps = {
  active: SettingsSectionId;
  status: StatusDto;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  compact: boolean;
  dataPortable: boolean;
  setDataPortable: (v: boolean) => void;
  theme: string | undefined;
  setTheme: (t: string) => void;
  bioPassword: string;
  setBioPassword: (v: string) => void;
  bioPersistedOn: boolean;
  cryptoInfo: VaultCryptoInfo | null;
  setCryptoInfo: (v: VaultCryptoInfo | null) => void;
  defaultKdf: VaultCryptoInfo | null;
  importPeek: VaultCryptoInfo | null;
  setImportPeek: (v: VaultCryptoInfo | null) => void;
  currentPw: string;
  setCurrentPw: (v: string) => void;
  newPw: string;
  setNewPw: (v: string) => void;
  importPw: string;
  setImportPw: (v: string) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | undefined;
  onError: (e: string) => void;
  onImported: (result?: import("@/lib/api").ImportResult) => Promise<void>;
  onWorkspacesChanged: (list: WorkspaceSummary[]) => void | Promise<void>;
  onDataDirChanged?: () => void | Promise<void>;
  onOpenShortcutsHelp?: () => void;
};

export function SettingsSectionContent(props: SettingsSectionsProps) {
  const meta = SETTINGS_SECTION_META[props.active];

  return (
    <div className="settings-content animate-rise min-h-0 flex-1 overflow-y-auto scroll-region px-4 py-5 sm:px-6 md:px-8 md:py-7 lg:px-10">
      <div className="settings-content__inner">
        <header className="mb-6 border-b border-[var(--border)] pb-5">
          <h2 className="settings-section-title">{meta.title}</h2>
          <p className="settings-section-desc">{meta.description}</p>
          {props.active === "portable-data" && (
            <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
              {props.status.dataDir}
              {!props.compact && (props.dataPortable ? " · portable" : " · custom")}
            </p>
          )}
        </header>

        <div>{renderSection(props)}</div>
      </div>
    </div>
  );
}

function renderSection(p: SettingsSectionsProps) {
  switch (p.active) {
    case "appearance":
      return <AppearanceSection {...p} />;
    case "keyboard":
      return <KeyboardSection {...p} />;
    case "lock-clipboard":
      return <LockClipboardSection {...p} />;
    case "convenience-unlock":
      return <ConvenienceUnlockSection {...p} />;
    case "master-password":
      return <MasterPasswordSection {...p} />;
    case "portable-data":
      return <PortableDataSection {...p} />;
    case "snapshots":
      return <SnapshotsSection {...p} />;
    case "recycle-bin":
      return <RecycleBinSection {...p} />;
    case "network":
      return <NetworkSection {...p} />;
    case "desktop-fill":
      return <DesktopFillSection {...p} />;
    case "workspaces":
      return <WorkspacesSection {...p} />;
    case "import-export":
      return <ImportExportSection {...p} />;
    default:
      return null;
  }
}

function AppearanceSection({ settings, setSettings, theme, setTheme }: SettingsSectionsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themeValue = normalizeTheme(settings.theme ?? theme);

  async function persistAppearance(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.saveSettings(next);
    } catch {
      /* keep local preference if persist fails */
    }
  }

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-md bg-[var(--inset)]" />
        <div className="h-10 animate-pulse rounded-md bg-[var(--inset)]" />
        <div className="h-10 animate-pulse rounded-md bg-[var(--inset)]" />
      </div>
    );
  }

  return (
    <SettingsCard>
      <SettingsField label="Theme" hint="Matches the titlebar toggle. Saved immediately.">
        <Select
          value={themeValue}
          onValueChange={(value) => {
            const next = normalizeTheme(value);
            setTheme(next);
            void persistAppearance({ theme: next });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField
        label="Color scheme"
        hint="Seafoam is the classic teal. Graphite uses amber on cool charcoal — both include light and dark."
      >
        <Select
          value={normalizeSkin(settings.skin)}
          onValueChange={(value) => {
            const next = normalizeSkin(value);
            applyDocumentSkin(next);
            void persistAppearance({ skin: next });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Color scheme" />
          </SelectTrigger>
          <SelectContent>
            {SKIN_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {SKIN_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mt-3">
          <div className="mb-1 text-xs text-[var(--muted)]">Preview</div>
          <div className="flex gap-2">
            <div
              className="skin-scope flex-1 rounded-md border border-[var(--border)] p-2"
              data-skin={normalizeSkin(settings.skin)}
            >
              <div className="text-center text-xs font-medium">Light</div>
              <div className="mt-2 space-y-2">
                <div
                  className="h-14 rounded-md border border-[var(--border)]"
                  style={{ background: "var(--background)", color: "var(--foreground)" }}
                >
                  <div className="flex h-full items-center justify-center font-medium">
                    Aa
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="h-10 rounded-md border border-[var(--border)]"
                    style={{ background: "var(--surface)" }}
                    aria-hidden
                  />
                  <div
                    className="h-10 rounded-md"
                    style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>

            <div
              className="skin-scope dark flex-1 rounded-md border border-[var(--border)] p-2"
              data-skin={normalizeSkin(settings.skin)}
            >
              <div className="text-center text-xs font-medium">Dark</div>
              <div className="mt-2 space-y-2">
                <div
                  className="h-14 rounded-md border border-[var(--border)]"
                  style={{ background: "var(--background)", color: "var(--foreground)" }}
                >
                  <div className="flex h-full items-center justify-center font-medium">
                    Aa
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="h-10 rounded-md border border-[var(--border)]"
                    style={{ background: "var(--surface)" }}
                    aria-hidden
                  />
                  <div
                    className="h-10 rounded-md"
                    style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsField>

      <SettingsField label="Entry layout" hint="Default dashboard view. You can still toggle from the toolbar.">
        <Select
          value={settings.entryLayout ?? "list"}
          onValueChange={(value) => {
            const next = value as AppSettings["entryLayout"];
            void persistAppearance({ entryLayout: next });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="grid">Grid</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField label="Entries per page">
        <PageSizeRow
          value={settings.pageSize}
          onChange={(size) => {
            void persistAppearance({ pageSize: size });
          }}
          className="max-w-sm"
        />
      </SettingsField>
    </SettingsCard>
  );
}

function KeyboardSection({ settings, setSettings, onError, onOpenShortcutsHelp }: SettingsSectionsProps) {
  const [capturing, setCapturing] = useState<KeybindingAction | null>(null);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const overrides = settings.keybindingOverrides ?? {};
  const resolved = resolveBindings(overrides);

  async function persistOverrides(next: Record<string, string>) {
    const updated = { ...settings, keybindingOverrides: next };
    setSettings(updated);
    try {
      await api.saveSettings(updated);
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setCaptureHint(null);
        return;
      }
      const chord = eventToChord(e);
      if (!chord) {
        setCaptureHint("Press a key combination…");
        return;
      }
      const conflict = findConflict(capturing, chord, {
        ...overrides,
        [capturing]: chord,
      });
      if (conflict) {
        setCaptureHint(`Conflicts with “${KEYBINDING_LABELS[conflict]}”. Try another.`);
        return;
      }
      const next = { ...overrides, [capturing]: chord };
      void persistOverrides(next);
      setCapturing(null);
      setCaptureHint(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture session only
  }, [capturing, overrides]);

  return (
    <SettingsCard
      title="Shortcuts"
      description="Click Change, then press the new keys. Esc cancels capture."
    >
      {KEYBINDING_GROUPS.map((group) => (
        <div key={group.id} className="mb-4 last:mb-0">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            {group.label}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {group.actions.map((action) => {
              const isCapturing = capturing === action;
              return (
                <li
                  key={action}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 text-[var(--foreground)]">
                    {KEYBINDING_LABELS[action]}
                  </span>
                  <kbd className="rounded border border-[var(--border)] bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
                    {isCapturing ? "Press keys…" : formatChords(resolved[action])}
                  </kbd>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => {
                        setCapturing(action);
                        setCaptureHint(`Recording for ${KEYBINDING_LABELS[action]}…`);
                      }}
                    >
                      {isCapturing ? "Listening" : "Change"}
                    </button>
                    {overrides[action] && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => {
                          const next = { ...overrides };
                          delete next[action];
                          void persistOverrides(next);
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {captureHint && (
        <p className="mt-2 text-xs text-[var(--muted)]" role="status">
          {captureHint}
        </p>
      )}

      <div className="settings-actions mt-4">
        <button
          type="button"
          className="btn-ghost"
          disabled={Object.keys(overrides).length === 0}
          onClick={() => void persistOverrides({})}
        >
          Reset all to defaults
        </button>
        {onOpenShortcutsHelp && (
          <button type="button" className="btn-ghost" onClick={onOpenShortcutsHelp}>
            View cheatsheet
          </button>
        )}
      </div>
    </SettingsCard>
  );
}

const IDLE_LOCK_PRESETS = [
  { value: 0, label: "Never" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
] as const;

function normalizeIdleLockSeconds(value: number | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 300;
  if (n === 0) return 0;
  const presets = IDLE_LOCK_PRESETS.map((p) => p.value).filter((v) => v > 0);
  if (presets.includes(n as (typeof presets)[number])) return n;
  return presets.reduce((best, p) => (Math.abs(p - n) < Math.abs(best - n) ? p : best), 300);
}

function LockClipboardSection({ settings, setSettings }: SettingsSectionsProps) {
  const idleValue = String(normalizeIdleLockSeconds(settings.autoLockSeconds));

  return (
    <SettingsCard
      title="Auto-lock"
      description="Idle timer uses app input (pointer/key), not OS system-idle. Lock-on-hide covers tab switch, minimize, and backgrounding the WebView."
    >
      <SettingsField
        label="Idle lock"
        hint="Locks after no pointer or keyboard activity in the app. Never disables idle auto-lock only — lock-on-hide still applies if enabled."
      >
        <Select
          value={idleValue}
          onValueChange={(value) => {
            setSettings({
              ...settings,
              autoLockSeconds: normalizeIdleLockSeconds(Number(value)),
            });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Idle lock" />
          </SelectTrigger>
          <SelectContent>
            {IDLE_LOCK_PRESETS.map((p) => (
              <SelectItem key={p.value} value={String(p.value)}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>
      <label className="flex items-start gap-2.5 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.lockOnHide !== false}
          onChange={(e) => setSettings({ ...settings, lockOnHide: e.target.checked })}
        />
        <span>
          <span className="font-medium">Lock when window is hidden</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            On by default. Turn off to keep the vault unlocked while switching apps.
          </span>
        </span>
      </label>
      <SettingsField label="Clipboard clear (seconds)" hint="New installs default to 15 seconds.">
        <input
          type="number"
          min={5}
          className="inset-field h-9 w-full px-3"
          value={settings.clipboardClearSeconds}
          onChange={(e) =>
            setSettings({
              ...settings,
              clipboardClearSeconds: Number(e.target.value) || 15,
            })
          }
        />
      </SettingsField>
    </SettingsCard>
  );
}

function ConvenienceUnlockSection({
  settings,
  setSettings,
  dataPortable,
  bioPassword,
  setBioPassword,
  bioPersistedOn,
}: SettingsSectionsProps) {
  return (
    <SettingsCard>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.biometricUnlock}
          onChange={(e) => setSettings({ ...settings, biometricUnlock: e.target.checked })}
        />
        <span>
          <span className="font-medium text-[var(--foreground)]">Convenience unlock (off by default)</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Stores your master password in the OS keyring. On mobile, Gate asks for OS biometrics before
            unlocking. Master password always works. Enable only on devices you trust.
          </span>
        </span>
      </label>
      {dataPortable && settings.biometricUnlock && (
        <p className="mt-2 text-xs text-[var(--foreground)]">
          Portable / USB kits: OS keyring is machine-local and does not travel with the folder. Prefer
          master password unlock on shared drives.
        </p>
      )}
      {settings.biometricUnlock && (
        <label className="mt-3 block text-sm">
          Master password to store in keyring
          <input
            type="password"
            className="inset-field mt-1 w-full px-3 py-2"
            value={bioPassword}
            onChange={(e) => setBioPassword(e.target.value)}
            placeholder={
              bioPersistedOn ? "Optional — enter only to refresh the stored secret" : "Required to enable"
            }
            autoComplete="current-password"
          />
        </label>
      )}
    </SettingsCard>
  );
}

function MasterPasswordSection({
  currentPw,
  setCurrentPw,
  newPw,
  setNewPw,
  onError,
}: SettingsSectionsProps) {
  return (
    <SettingsCard>
      <input
        type="password"
        placeholder="Current password"
        className="inset-field mb-3 h-9 w-full max-w-sm px-3"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
      />
      <input
        type="password"
        placeholder="New password"
        className="inset-field mb-4 h-9 w-full max-w-sm px-3"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={() =>
          api
            .changeMasterPassword(currentPw, newPw)
            .then(() => {
              setCurrentPw("");
              setNewPw("");
              onError("");
            })
            .catch((e) => {
              setCurrentPw("");
              setNewPw("");
              onError(String(e));
            })
        }
      >
        Update password
      </button>
    </SettingsCard>
  );
}

function PortableDataSection({
  compact,
  dataPortable,
  setDataPortable,
  onError,
  onDataDirChanged,
}: SettingsSectionsProps) {
  if (compact) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Data folder controls are available on desktop. Mobile uses the app sandbox.
      </p>
    );
  }

  return (
    <SettingsCard>
      <p className="settings-card__desc">
        Point this folder at a location you sync yourself (Syncthing, cloud drive, or USB). Keep the
        whole data directory together — especially <code className="text-[var(--foreground)]">vault.km</code>{" "}
        and <code className="text-[var(--foreground)]">attachments/</code>. Clavis does not run its own
        sync; concurrent edits on two machines use last-write-wins on the encrypted vault file.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Portable kit: copy this entire install folder (app +{" "}
        <code className="text-[var(--foreground)]">data/</code>) to another PC or USB.
      </p>
      {!dataPortable && (
        <p className="mt-2 text-xs text-[var(--foreground)]">
          Custom absolute data path — plug-and-play breaks if the drive letter changes. Use{" "}
          <strong>Make portable</strong> to relocate vault files next to the executable.
        </p>
      )}
      <div className="settings-actions mt-4">
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            const ok = await appConfirm({
              title: "Change data directory?",
              description:
                "The vault will lock. Choose a folder for vault.km, attachments/, and config. Existing data is not moved automatically — copy the whole data folder yourself if needed (or use Make portable).",
              confirmLabel: "Choose folder",
            });
            if (!ok) return;
            try {
              const folder = await api.pickDataDir();
              if (!folder) return;
              const info = await api.setDataDir(folder);
              setDataPortable(info.portable);
              onError(`Data directory set to ${info.path}. Unlock again to continue.`);
              await onDataDirChanged?.();
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Use synced / custom folder…
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={dataPortable}
          onClick={async () => {
            const ok = await appConfirm({
              title: "Reset to portable data folder?",
              description:
                "Uses {app}/data next to the executable again. The vault will lock. Custom-folder files are left in place (not copied).",
              confirmLabel: "Reset",
            });
            if (!ok) return;
            try {
              const info = await api.setDataDir(null);
              setDataPortable(info.portable);
              onError(`Data directory reset to ${info.path}. Unlock again to continue.`);
              await onDataDirChanged?.();
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Use portable default
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={dataPortable}
          onClick={async () => {
            const ok = await appConfirm({
              title: "Make portable?",
              description:
                "Copies vault.km, config.json, icons, attachments, and snapshots into {app}/data next to the executable, then clears the custom path. The vault will lock.",
              confirmLabel: "Make portable",
            });
            if (!ok) return;
            try {
              let info = await api.makeDataDirPortable(false).catch(async (e) => {
                const msg = String(e);
                if (!msg.includes("overwrite")) throw e;
                const force = await appConfirm({
                  title: "Overwrite portable vault?",
                  description:
                    "A different vault.km already exists in {app}/data. Replace it with the current vault?",
                  confirmLabel: "Overwrite",
                  danger: true,
                });
                if (!force) return null;
                return api.makeDataDirPortable(true);
              });
              if (!info) return;
              setDataPortable(info.portable);
              onError(`Portable data at ${info.path}. Unlock again to continue.`);
              await onDataDirChanged?.();
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Make portable
        </button>
      </div>
    </SettingsCard>
  );
}

function SnapshotsSection({ settings, setSettings, status, onError, onImported }: SettingsSectionsProps) {
  return (
    <SettingsCard
      description="Dated copies of encrypted vault.km under the data folder. Restore replaces the live vault and re-unlocks."
    >
      <SettingsField label="Keep last N snapshots">
        <input
          type="number"
          min={1}
          max={50}
          className="inset-field h-9 w-full px-3"
          value={settings.snapshotRetain ?? 10}
          onChange={(e) =>
            setSettings({
              ...settings,
              snapshotRetain: Math.max(1, Math.min(50, Number(e.target.value) || 10)),
            })
          }
        />
      </SettingsField>
      <SnapshotsControls
        unlocked={status.state === "unlocked"}
        onError={onError}
        onRestored={async () => {
          await onImported();
        }}
      />
    </SettingsCard>
  );
}

function RecycleBinSection({ settings, setSettings }: SettingsSectionsProps) {
  return (
    <SettingsCard>
      <SettingsField
        label="Recycle bin retain (days)"
        hint="Soft-deleted entries older than this are purged on unlock."
      >
        <input
          type="number"
          min={1}
          max={365}
          className="inset-field h-9 w-full px-3"
          value={settings.trashRetainDays ?? 30}
          onChange={(e) =>
            setSettings({
              ...settings,
              trashRetainDays: Math.max(1, Number(e.target.value) || 30),
            })
          }
        />
      </SettingsField>
    </SettingsCard>
  );
}

function NetworkSection({ settings, setSettings }: SettingsSectionsProps) {
  return (
    <SettingsCard description="Outbound HTTP is off by default. Enabling network only unlocks optional features.">
      <label className="flex items-start gap-2.5 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(settings.allowNetwork)}
          onChange={(e) =>
            setSettings({
              ...settings,
              allowNetwork: e.target.checked,
              fetchFavicons: e.target.checked ? settings.fetchFavicons : false,
              checkBreaches: e.target.checked ? settings.checkBreaches : false,
            })
          }
        />
        <span>
          Allow network
          <span className="mt-0.5 block text-xs text-[var(--muted)]">Master gate for outbound requests from Clavis.</span>
        </span>
      </label>
      <label className={`mt-3 flex items-start gap-2 text-sm ${!settings.allowNetwork ? "opacity-50" : ""}`}>
        <input
          type="checkbox"
          className="mt-0.5"
          disabled={!settings.allowNetwork}
          checked={Boolean(settings.fetchFavicons) && Boolean(settings.allowNetwork)}
          onChange={(e) => setSettings({ ...settings, fetchFavicons: e.target.checked })}
        />
        <span>
          Fetch site icons for login URLs
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Cached under data/icons. Requires Allow network.
          </span>
        </span>
      </label>
      <label className={`mt-3 flex items-start gap-2 text-sm ${!settings.allowNetwork ? "opacity-50" : ""}`}>
        <input
          type="checkbox"
          className="mt-0.5"
          disabled={!settings.allowNetwork}
          checked={Boolean(settings.checkBreaches) && Boolean(settings.allowNetwork)}
          onChange={(e) => setSettings({ ...settings, checkBreaches: e.target.checked })}
        />
        <span>
          Check breaches (HIBP)
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Opt-in one-shot k-anonymity checks from Password health.
          </span>
        </span>
      </label>
    </SettingsCard>
  );
}

function DesktopFillSection({ settings, setSettings }: SettingsSectionsProps) {
  return (
    <SettingsCard description="Opt-in SendInput into the focused window after confirm. Windows desktop only.">
      <label className="flex items-start gap-2.5 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(settings.autotypeEnabled)}
          onChange={(e) => setSettings({ ...settings, autotypeEnabled: e.target.checked })}
        />
        <span>Enable autotype</span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(settings.suggestFromForeground)}
          onChange={(e) => setSettings({ ...settings, suggestFromForeground: e.target.checked })}
        />
        <span>Suggest from window title</span>
      </label>
      <SettingsField label="Key delay (ms)">
        <input
          type="number"
          min={0}
          max={200}
          className="inset-field h-9 w-full px-3"
          value={settings.autotypeKeyDelayMs ?? 25}
          onChange={(e) =>
            setSettings({
              ...settings,
              autotypeKeyDelayMs: Math.max(0, Number(e.target.value) || 25),
            })
          }
        />
      </SettingsField>
    </SettingsCard>
  );
}

function WorkspacesSection({
  activeWorkspace,
  renameValue,
  setRenameValue,
  onError,
  onWorkspacesChanged,
}: SettingsSectionsProps) {
  return (
    <>
      <p className="text-sm text-[var(--muted)]">
        Each imported file becomes its own workspace. Manage cards on the dashboard; rename or delete the active
        one here.
      </p>
      <p className="text-sm">
        Active: <span className="font-medium">{activeWorkspace?.name ?? "—"}</span>
        {activeWorkspace ? (
          <span className="text-[var(--muted)]"> · {activeWorkspace.entryCount} entries</span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="inset-field min-w-[180px] flex-1 px-3 py-2"
          placeholder="Rename active workspace"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            if (!activeWorkspace || !renameValue.trim()) return;
            try {
              const list = await api.renameWorkspace(activeWorkspace.id, renameValue.trim());
              setRenameValue("");
              await onWorkspacesChanged(list);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={async () => {
            if (!activeWorkspace) return;
            const ok = await appConfirm({
              title: "Delete workspace?",
              description: `Delete workspace “${activeWorkspace.name}” and all of its entries? This cannot be undone.`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (!ok) return;
            try {
              const list = await api.deleteWorkspace(activeWorkspace.id);
              await onWorkspacesChanged(list);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Delete active
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            const ok = await appConfirm({
              title: "Merge duplicate workspaces?",
              description:
                "Workspaces with the same name (ignoring case) will be combined. Entries are kept; extra copies of the workspace are removed.",
              confirmLabel: "Merge duplicates",
            });
            if (!ok) return;
            try {
              const result = await api.mergeDuplicateWorkspaces();
              await onWorkspacesChanged(result.workspaces);
              onError(
                result.removed === 0
                  ? "No duplicate workspace names found."
                  : `Merged duplicates — removed ${result.removed} workspace(s).`,
              );
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Merge duplicates
        </button>
      </div>
    </>
  );
}

function ImportExportSection(p: SettingsSectionsProps) {
  const {
    cryptoInfo,
    setCryptoInfo,
    defaultKdf,
    importPeek,
    setImportPeek,
    importPw,
    setImportPw,
    activeWorkspace,
    onError,
    onImported,
  } = p;

  return (
    <>
      <p className="text-sm text-[var(--muted)]">
        Encrypted backups use the same format as <code className="text-[var(--foreground)]">vault.km</code>.
        Credential imports create a new workspace. Use Replace to overwrite the current workspace list.
      </p>
      {cryptoInfo && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--inset)]/50 px-3 py-2 text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">Active vault KDF: </span>
          {formatVaultCryptoInfo(cryptoInfo)}
          {defaultKdf && isWeakerThanDefaults(cryptoInfo, defaultKdf) && (
            <span className="mt-1 block text-[var(--foreground)]">
              Weaker than current Clavis defaults — use Upgrade KDF below.
            </span>
          )}
        </p>
      )}
      {importPeek && (
        <p className="text-xs text-[var(--muted)]">Last peeked backup: {formatVaultCryptoInfo(importPeek)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              const info = cryptoInfo ?? (await api.vaultCryptoInfo());
              const ok = await appConfirm({
                title: "Export encrypted backup?",
                description: `Writes a portable .km file using ${formatVaultCryptoInfo(info)}.`,
                confirmLabel: "Choose destination",
              });
              if (!ok) return;
              const dest = await api.pickSavePath("clavis-backup.km");
              if (dest) {
                await api.exportVault(dest);
                onError(`Exported encrypted backup to ${dest}`);
              }
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Export encrypted backup
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              const source = await api.pickOpenPath("vault");
              if (!source) return;
              let peek: VaultCryptoInfo | null = null;
              try {
                peek = await api.peekVaultKdf(source);
                setImportPeek(peek);
              } catch {
                setImportPeek(null);
              }
              if (!importPw) {
                onError(
                  peek
                    ? `Backup KDF: ${formatVaultCryptoInfo(peek)}. Enter the backup master password below, then import again.`
                    : "Enter the backup master password below first.",
                );
                return;
              }
              const defaults = defaultKdf ?? (await api.defaultVaultKdf());
              if (peek && isWeakerThanDefaults(peek, defaults)) {
                const proceed = await appConfirm({
                  title: "Weaker KDF in backup",
                  description: `This file uses ${formatVaultCryptoInfo(peek)}. Import anyway?`,
                  confirmLabel: "Import",
                  danger: true,
                });
                if (!proceed) return;
              }
              await api.importVault(source, importPw);
              setImportPw("");
              setImportPeek(null);
              const live = await api.vaultCryptoInfo().catch(() => null);
              setCryptoInfo(live);
              await onImported();
            } catch (e) {
              setImportPw("");
              onError(String(e));
            }
          }}
        >
          Import encrypted backup
        </button>
        {cryptoInfo && defaultKdf && isWeakerThanDefaults(cryptoInfo, defaultKdf) && (
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              try {
                const password = await appPrompt({
                  title: "Upgrade vault KDF",
                  description: `Re-wrap with ${formatVaultCryptoInfo(defaultKdf)}.`,
                  confirmLabel: "Upgrade",
                  password: true,
                });
                if (!password) return;
                const info = await api.upgradeVaultKdf(password);
                setCryptoInfo(info);
                onError(`KDF upgraded: ${formatVaultCryptoInfo(info)}`);
              } catch (e) {
                onError(String(e));
              }
            }}
          >
            Upgrade KDF to defaults
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              const source = await api.pickOpenPath("credentials");
              if (!source) return;
              const result = await importCredentialsFileSmart(source, "new");
              if (!result) return;
              onError(formatImportMessage(result));
              await onImported(result);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Import → new workspace
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={async () => {
            try {
              const ok = await appConfirm({
                title: "Replace workspace?",
                description: `Replace all entries in “${activeWorkspace?.name ?? "this workspace"}” with the imported file?`,
                confirmLabel: "Replace",
                danger: true,
              });
              if (!ok) return;
              const source = await api.pickOpenPath("credentials");
              if (!source) return;
              const result = await api.importCredentialsFile(source, "replace");
              onError(formatImportMessage(result));
              await onImported(result);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Replace current workspace
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              const source = await api.pickOpenPath("csv");
              if (!source) return;
              const result = await importCredentialsFileSmart(source, "new");
              if (!result) return;
              onError(formatImportMessage(result));
              await onImported(result);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          Import CSV / TSV → new
        </button>
      </div>
      <FileDropZone
        className="mt-2"
        compact
        mode="new"
        onImported={async (result) => {
          onError(formatImportMessage(result));
          await onImported(result);
        }}
        onError={onError}
      />
      <input
        type="password"
        placeholder="Password for encrypted import"
        className="inset-field mt-3 w-full px-3 py-2"
        value={importPw}
        onChange={(e) => setImportPw(e.target.value)}
      />
    </>
  );
}

function SnapshotsControls({
  unlocked,
  onError,
  onRestored,
}: {
  unlocked: boolean;
  onError: (e: string) => void;
  onRestored: () => Promise<void>;
}) {
  const [list, setList] = useState<SnapshotInfo[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!unlocked) {
      setList([]);
      return;
    }
    try {
      setList(await api.listVaultSnapshots());
    } catch {
      setList([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, [unlocked]);

  async function create() {
    setBusy(true);
    try {
      await api.createVaultSnapshot();
      await refresh();
      onError("");
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function restore(name: string) {
    const ok = await appConfirm({
      title: "Restore snapshot?",
      description: `Replace the live vault with “${name}”?`,
      confirmLabel: "Restore",
      danger: true,
    });
    if (!ok) return;
    const password = await appPrompt({
      title: "Master password",
      description: "Unlock the restored vault.",
      confirmLabel: "Unlock",
      password: true,
    });
    if (password == null || !password.trim()) return;
    setBusy(true);
    try {
      await api.restoreVaultSnapshot(name, password);
      await onRestored();
      await refresh();
      onError("Vault snapshot restored.");
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    const ok = await appConfirm({
      title: "Delete snapshot?",
      description: `Permanently delete “${name}”?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteVaultSnapshot(name);
      await refresh();
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  function formatSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        className="btn-ghost disabled:opacity-50"
        disabled={!unlocked || busy}
        onClick={() => void create()}
      >
        {busy ? "Working…" : "Create snapshot now"}
      </button>
      {!unlocked ? (
        <p className="text-xs text-[var(--muted)]">Unlock to manage snapshots.</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No snapshots yet.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {list.map((s) => (
            <li
              key={s.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {s.name} <span className="text-[var(--muted)]">· {formatSize(s.size)}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="btn-ghost-sm"
                  disabled={busy}
                  onClick={() => void restore(s.name)}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="btn-danger-sm"
                  disabled={busy}
                  onClick={() => void remove(s.name)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Appearance prefs save immediately — no sidebar Save button needed. */
export const SETTINGS_PERSIST_SECTIONS = new Set<SettingsSectionId>([
  "lock-clipboard",
  "convenience-unlock",
  "recycle-bin",
  "network",
  "desktop-fill",
  "snapshots",
]);
