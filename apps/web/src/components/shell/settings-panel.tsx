"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FileDropZone } from "@/components/import/file-drop-zone";
import { api, type AppSettings, type ImportResult, type StatusDto, type VaultCryptoInfo, type WorkspaceSummary, formatVaultCryptoInfo, isWeakerThanDefaults } from "@/lib/api";
import { importCredentialsFileSmart } from "@/lib/import";
import { appConfirm, appPrompt } from "@/lib/app-dialogs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatImportMessage(result: ImportResult) {
  if (result.replaced) {
    return `Replaced “${result.workspaceName}” with ${result.count} login(s).`;
  }
  return `Imported ${result.count} login(s) into workspace “${result.workspaceName}”.`;
}

export function SettingsPanel({
  status,
  settings,
  setSettings,
  workspaces,
  onError,
  onImported,
  onWorkspacesChanged,
  onDataDirChanged,
  compact = false,
}: {
  status: StatusDto;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  workspaces: WorkspaceSummary[];
  onError: (e: string) => void;
  onImported: (result?: ImportResult) => Promise<void>;
  onWorkspacesChanged: (list: WorkspaceSummary[]) => void | Promise<void>;
  onDataDirChanged?: () => void | Promise<void>;
  /** Phone-width / mobile — hide desktop portable data-folder controls. */
  compact?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [importPw, setImportPw] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [dataPortable, setDataPortable] = useState(true);
  const [bioPassword, setBioPassword] = useState("");
  /** Last persisted convenience-unlock flag — used so re-saving other prefs does not demand the password again. */
  const [bioPersistedOn, setBioPersistedOn] = useState(settings.biometricUnlock);
  const [cryptoInfo, setCryptoInfo] = useState<VaultCryptoInfo | null>(null);
  const [defaultKdf, setDefaultKdf] = useState<VaultCryptoInfo | null>(null);
  const [importPeek, setImportPeek] = useState<VaultCryptoInfo | null>(null);
  const active = workspaces.find((w) => w.active);

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

  return (
    <section className="animate-rise mx-auto grid h-full min-h-0 w-full max-w-2xl gap-5 overflow-y-auto scroll-region p-1 pr-2">
      <div className="panel p-5">
        <h2 className="font-display text-2xl">Settings</h2>
        <p className="mt-2 break-all text-xs text-[var(--muted)]">
          Data directory: {status.dataDir}
          {!compact && (dataPortable ? " (portable default)" : " (custom)")}
          {compact && " (app sandbox)"}
        </p>
        {!compact && (
        <div className="mt-3 flex flex-wrap gap-2" data-desktop-only>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
            onClick={async () => {
              const ok = await appConfirm({
                title: "Change data directory?",
                description:
                  "The vault will lock. Choose a folder for vault.km and config.json. Existing data is not moved automatically — copy files yourself if needed.",
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
            Change data folder…
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
            disabled={dataPortable}
            onClick={async () => {
              const ok = await appConfirm({
                title: "Reset to portable data folder?",
                description:
                  "Uses {app}/data next to the executable again. The vault will lock. Custom-folder files are left in place.",
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
        </div>
        )}

        <label className="mt-5 block text-sm">
          Theme
          <Select
            value={settings.theme ?? theme ?? "system"}
            onValueChange={(value) => {
              const next = value as AppSettings["theme"];
              setTheme(next);
              setSettings({ ...settings, theme: next });
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--inset)]/40 p-3">
          <p className="text-sm font-medium text-[var(--foreground)]">Auto-lock</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Idle timer uses app input (pointer/key), not OS system-idle. Lock-on-hide covers tab
            switch, minimize, and backgrounding the WebView.
          </p>
          <label className="mt-3 block text-sm">
            Idle lock (seconds)
            <input
              type="number"
              min={30}
              className="inset-field mt-1 w-full px-3 py-2"
              value={settings.autoLockSeconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoLockSeconds: Number(e.target.value) || 300,
                })
              }
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.lockOnHide !== false}
              onChange={(e) =>
                setSettings({ ...settings, lockOnHide: e.target.checked })
              }
            />
            <span>
              Lock when window is hidden
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                On by default. Turn off to keep the vault unlocked while switching apps (idle
                timer still applies).
              </span>
            </span>
          </label>
        </div>
        <label className="mt-4 block text-sm">
          Clipboard clear (seconds)
          <input
            type="number"
            min={5}
            className="inset-field mt-1 w-full px-3 py-2"
            value={settings.clipboardClearSeconds}
            onChange={(e) =>
              setSettings({
                ...settings,
                clipboardClearSeconds: Number(e.target.value) || 30,
              })
            }
          />
        </label>
        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--inset)]/40 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.biometricUnlock}
              onChange={(e) =>
                setSettings({ ...settings, biometricUnlock: e.target.checked })
              }
            />
            <span>
              <span className="font-medium text-[var(--foreground)]">
                Convenience unlock (off by default)
              </span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Stores your master password in the OS keyring. On mobile, Gate asks for OS
                biometrics before unlocking. Master password always works. Enable only on devices
                you trust.
              </span>
            </span>
          </label>
          {settings.biometricUnlock && (
            <label className="mt-3 block text-sm">
              Master password to store in keyring
              <input
                type="password"
                className="inset-field mt-1 w-full px-3 py-2"
                value={bioPassword}
                onChange={(e) => setBioPassword(e.target.value)}
                placeholder={
                  bioPersistedOn
                    ? "Optional — enter only to refresh the stored secret"
                    : "Required to enable"
                }
                autoComplete="current-password"
              />
            </label>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(settings.fetchFavicons)}
            onChange={(e) => setSettings({ ...settings, fetchFavicons: e.target.checked })}
          />
          Fetch site icons for login URLs (cached under data/icons; off by default)
        </label>
        <button
          className="mt-4 rounded-md bg-[var(--primary)] px-4 py-2 text-[var(--primary-fg)]"
          onClick={() => {
            void (async () => {
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
              }
            })();
          }}
        >
          Save preferences
        </button>
      </div>

      <div className="panel p-5">
        <h3 className="font-display text-xl">Workspaces</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Each imported file becomes its own workspace. Manage cards on the dashboard; rename or
          delete the active one here. Merge collapses same-name duplicates from older imports.
        </p>
        <p className="mt-3 text-sm">
          Active: <span className="font-medium">{active?.name ?? "—"}</span>
          {active ? (
            <span className="text-[var(--muted)]"> · {active.entryCount} entries</span>
          ) : null}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="inset-field min-w-[180px] flex-1 px-3 py-2"
            placeholder="Rename active workspace"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-4 py-2"
            onClick={async () => {
              if (!active || !renameValue.trim()) return;
              try {
                const list = await api.renameWorkspace(active.id, renameValue.trim());
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
            className="rounded-md border border-[var(--danger)]/40 px-4 py-2 text-[var(--danger)]"
            onClick={async () => {
              if (!active) return;
              const ok = await appConfirm({
                title: "Delete workspace?",
                description: `Delete workspace “${active.name}” and all of its entries? This cannot be undone.`,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              try {
                const list = await api.deleteWorkspace(active.id);
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
            className="rounded-md border border-[var(--border)] px-4 py-2"
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
      </div>

      <div className="panel p-5">
        <h3 className="font-display text-xl">Change master password</h3>
        <div className="mt-4 grid gap-3">
          <input
            type="password"
            placeholder="Current"
            className="inset-field px-3 py-2"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
          <input
            type="password"
            placeholder="New"
            className="inset-field px-3 py-2"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <button
            className="rounded-md border border-[var(--border)] px-4 py-2"
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
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="font-display text-xl">Import / export</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Encrypted backups use the same format as{" "}
          <code className="text-[var(--foreground)]">vault.km</code> (Argon2id + AES-256-GCM).
          Credential imports create a new workspace (named from the file). Use Replace to overwrite
          the current workspace list.
        </p>
        {cryptoInfo && (
          <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--inset)]/50 px-3 py-2 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground)]">Active vault KDF: </span>
            {formatVaultCryptoInfo(cryptoInfo)}
            {defaultKdf && isWeakerThanDefaults(cryptoInfo, defaultKdf) && (
              <span className="mt-1 block text-[var(--foreground)]">
                Weaker than current Clavis defaults — use “Upgrade KDF” below after confirming your
                master password.
              </span>
            )}
          </p>
        )}
        {importPeek && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Last peeked backup: {formatVaultCryptoInfo(importPeek)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-[var(--border)] px-4 py-2"
            onClick={async () => {
              try {
                const info = cryptoInfo ?? (await api.vaultCryptoInfo());
                const ok = await appConfirm({
                  title: "Export encrypted backup?",
                  description: `Writes a portable .km file using ${formatVaultCryptoInfo(info)}. Same format as the live vault — keep the master password safe.`,
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
            className="rounded-md border border-[var(--border)] px-4 py-2"
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
                    description: `This file uses ${formatVaultCryptoInfo(peek)}. Current Clavis defaults are stronger (${formatVaultCryptoInfo(defaults)}). Import anyway? You can upgrade the live vault afterward.`,
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
                if (live && isWeakerThanDefaults(live, defaults)) {
                  onError(
                    `Imported. Vault KDF is weaker than defaults (${formatVaultCryptoInfo(live)}). Use Upgrade KDF when ready.`,
                  );
                }
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
              className="rounded-md border border-[var(--border)] px-4 py-2"
              onClick={async () => {
                try {
                  const password = await appPrompt({
                    title: "Upgrade vault KDF",
                    description: `Re-wrap with ${formatVaultCryptoInfo(defaultKdf)}. Enter your master password.`,
                    inputLabel: "Master password",
                    placeholder: "Required",
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
            className="rounded-md border border-[var(--border)] px-4 py-2"
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
            className="rounded-md border border-[var(--border)] px-4 py-2"
            onClick={async () => {
              try {
                const ok = await appConfirm({
                  title: "Replace workspace?",
                  description: `Replace all entries in “${active?.name ?? "this workspace"}” with the imported file?`,
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
            className="rounded-md border border-[var(--border)] px-4 py-2"
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
          className="mt-4"
          compact
          mode="new"
          onImported={async (result) => {
            onError(formatImportMessage(result));
            await onImported(result);
          }}
          onError={onError}
        />
        <p className="mt-3 text-xs text-[var(--muted)]">
          Drop files above or use Browse. Text blocks with Username / Email / Password are
          detected automatically. Spreadsheets use the first sheet.
        </p>
        <input
          type="password"
          placeholder="Password for encrypted import"
          className="inset-field mt-3 w-full px-3 py-2"
          value={importPw}
          onChange={(e) => setImportPw(e.target.value)}
        />
      </div>
    </section>
  );
}
