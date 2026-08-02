"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  AppSettings,
  EntrySummary,
  EntryType,
  StatusDto,
  UpsertEntryInput,
  normalizeEntry,
} from "@/lib/api";

type View = "boot" | "gate" | "vault" | "editor" | "settings";

const emptyForm: UpsertEntryInput = {
  entryType: "login",
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
  customFields: [],
};

export default function HomePage() {
  const [view, setView] = useState<View>("boot");
  const [status, setStatus] = useState<StatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<UpsertEntryInput>(emptyForm);
  const [settings, setSettings] = useState<AppSettings>({
    autoLockSeconds: 300,
    clipboardClearSeconds: 30,
    biometricUnlock: false,
  });
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStatus = useCallback(async () => {
    const s = await api.status();
    setStatus(s);
    if (s.state === "unlocked") {
      const list = await api.listEntries();
      setEntries(list);
      setView((v) => (v === "editor" || v === "settings" ? v : "vault"));
    } else {
      setEntries([]);
      setView("gate");
    }
    return s;
  }, []);

  useEffect(() => {
    refreshStatus().catch((e) => {
      setError(String(e));
      setView("gate");
    });
  }, [refreshStatus]);

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, [status?.state]);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (status?.state !== "unlocked") return;
    const ms = Math.max(30, settings.autoLockSeconds) * 1000;
    idleTimer.current = setTimeout(() => {
      api.lock()
        .then(() => refreshStatus())
        .catch(() => undefined);
    }, ms);
  }, [status?.state, settings.autoLockSeconds, refreshStatus]);

  useEffect(() => {
    resetIdle();
    const onActivity = () => resetIdle();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    const onVis = () => {
      if (document.hidden && status?.state === "unlocked") {
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
  }, [resetIdle, status?.state, refreshStatus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  async function copyText(label: string, text: string) {
    if (!text) return;
    try {
      const { writeText, clear } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      setCopyFlash(label);
      setTimeout(() => setCopyFlash(null), 700);
      const clearAfter = Math.max(5, settings.clipboardClearSeconds) * 1000;
      setTimeout(() => {
        clear().catch(() => undefined);
      }, clearAfter);
    } catch {
      await navigator.clipboard.writeText(text);
      setCopyFlash(label);
      setTimeout(() => setCopyFlash(null), 700);
    }
  }

  async function openEntry(id: string) {
    setError(null);
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
    setView("editor");
  }

  if (view === "boot") {
    return (
      <main className="grid min-h-screen place-items-center p-8">
        <p className="text-[var(--muted)]">Opening vault…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 md:px-8">
      <header className="animate-rise mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.22em] text-[var(--accent)] uppercase">
            Local · Portable · Encrypted
          </p>
          <h1 className="font-display mt-2 text-4xl tracking-tight md:text-5xl">Keys Manager</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Credentials stay in your install folder — never scattered across the OS as plaintext.
          </p>
        </div>
        {status?.state === "unlocked" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--bg2)]"
              onClick={() => setView("settings")}
            >
              Settings
            </button>
            <button
              className="rounded-md bg-[var(--bg2)] px-3 py-2 text-sm hover:bg-[var(--accent-dim)]"
              onClick={async () => {
                await api.lock();
                await refreshStatus();
              }}
            >
              Lock
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {view === "gate" && (
        <Gate
          status={status}
          onDone={async () => {
            setError(null);
            await refreshStatus();
          }}
          onError={setError}
        />
      )}

      {view === "vault" && (
        <section className="animate-rise grid gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="min-w-[220px] flex-1 rounded-md border border-[var(--line)] bg-[var(--bg2)]/70 px-3 py-2 outline-none focus:border-[var(--accent)]"
              placeholder="Search titles, users, URLs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg0)] hover:bg-[var(--accent-dim)]"
              onClick={() => {
                setForm(emptyForm);
                setView("editor");
              }}
            >
              New entry
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg2)]/35">
            {filtered.length === 0 ? (
              <p className="px-5 py-12 text-center text-[var(--muted)]">
                No entries yet. Create one or import a backup in Settings.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-white/3"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openEntry(e.id).catch((err) => setError(String(err)))}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.title}</span>
                        <TypePill type={e.entryType} />
                      </div>
                      <p className="truncate text-sm text-[var(--muted)]">
                        {e.username || e.url || "—"}
                      </p>
                    </button>
                    <div className="flex gap-2">
                      <CopyBtn
                        flash={copyFlash === `${e.id}:user`}
                        label="User"
                        onClick={async () => {
                          const full = normalizeEntry(await api.getEntry(e.id));
                          await copyText(`${e.id}:user`, full.username);
                        }}
                      />
                      <CopyBtn
                        flash={copyFlash === `${e.id}:pass`}
                        label="Pass"
                        onClick={async () => {
                          const full = normalizeEntry(await api.getEntry(e.id));
                          await copyText(`${e.id}:pass`, full.password);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {view === "editor" && (
        <Editor
          form={form}
          setForm={setForm}
          onCancel={() => setView("vault")}
          onSave={async () => {
            setError(null);
            await api.upsertEntry(form);
            await refreshStatus();
            setView("vault");
          }}
          onDelete={
            form.id
              ? async () => {
                  await api.deleteEntry(form.id!);
                  await refreshStatus();
                  setView("vault");
                }
              : undefined
          }
          onGenerate={async () => {
            const password = await api.generatePassword(20);
            setForm((f) => ({ ...f, password }));
          }}
          onError={setError}
        />
      )}

      {view === "settings" && status && (
        <SettingsPanel
          status={status}
          settings={settings}
          setSettings={setSettings}
          onBack={() => setView("vault")}
          onError={setError}
          onImported={async () => {
            await refreshStatus();
            setView("vault");
          }}
        />
      )}
    </main>
  );
}

function TypePill({ type }: { type: EntryType }) {
  return (
    <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--muted)] uppercase">
      {type}
    </span>
  );
}

function CopyBtn({
  label,
  onClick,
  flash,
}: {
  label: string;
  onClick: () => Promise<void>;
  flash: boolean;
}) {
  return (
    <button
      className={`rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs hover:bg-[var(--bg1)] ${flash ? "animate-copy border-[var(--accent)]" : ""}`}
      onClick={() => onClick().catch(() => undefined)}
    >
      {label}
    </button>
  );
}

function Gate({
  status,
  onDone,
  onError,
}: {
  status: StatusDto | null;
  onDone: () => Promise<void>;
  onError: (e: string) => void;
}) {
  const [name, setName] = useState("Personal");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(false);
  const missing = status?.state === "missing";

  useEffect(() => {
    if (missing) return;
    api
      .tryKeyringUnlock()
      .then(() => onDone())
      .catch(() => undefined);
  }, [missing, onDone]);

  return (
    <section className="animate-rise mx-auto w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg2)]/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <h2 className="font-display text-2xl">{missing ? "Create your vault" : "Unlock"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {missing
          ? "Choose a strong master password. It never leaves this device."
          : "Enter your master password to decrypt the local vault."}
      </p>

      {missing && (
        <label className="mt-5 block text-sm">
          Vault name
          <input
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <label className="mt-4 block text-sm">
        Master password
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </label>

      {missing && (
        <label className="mt-4 block text-sm">
          Confirm password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Remember unlock via OS keyring
      </label>

      <button
        className="mt-6 w-full rounded-md bg-[var(--accent)] py-2.5 font-medium text-[var(--bg0)] hover:bg-[var(--accent-dim)]"
        onClick={async () => {
          try {
            if (missing) {
              if (password.length < 8) throw new Error("Use at least 8 characters.");
              if (password !== confirm) throw new Error("Passwords do not match.");
              await api.createVault(name || "Personal", password);
            } else {
              await api.unlock(password);
            }
            if (remember) {
              await api.storeKeyringSecret(password);
              const s = await api.getSettings();
              await api.saveSettings({ ...s, biometricUnlock: true });
            }
            setPassword("");
            setConfirm("");
            await onDone();
          } catch (e) {
            onError(String(e).replace(/^Error:\s*/, ""));
          }
        }}
      >
        {missing ? "Create vault" : "Unlock"}
      </button>

      {status?.dataDir && (
        <p className="mt-4 break-all text-xs text-[var(--muted)]">Data: {status.dataDir}</p>
      )}
    </section>
  );
}

function Editor({
  form,
  setForm,
  onCancel,
  onSave,
  onDelete,
  onGenerate,
  onError,
}: {
  form: UpsertEntryInput;
  setForm: React.Dispatch<React.SetStateAction<UpsertEntryInput>>;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onError: (e: string) => void;
}) {
  return (
    <section className="animate-rise mx-auto w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--bg2)]/40 p-6">
      <h2 className="font-display text-2xl">{form.id ? "Edit entry" : "New entry"}</h2>
      <div className="mt-5 grid gap-4">
        <label className="text-sm">
          Type
          <select
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={form.entryType}
            onChange={(e) =>
              setForm((f) => ({ ...f, entryType: e.target.value as EntryType }))
            }
          >
            <option value="login">Login</option>
            <option value="note">Secure note</option>
            <option value="api">API / token</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <Field
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        />
        <Field
          label="Username"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v }))}
        />
        <label className="text-sm">
          Password / secret
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2 font-mono text-sm"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <button
              type="button"
              className="shrink-0 rounded-md border border-[var(--line)] px-3 text-sm hover:bg-[var(--bg1)]"
              onClick={() => onGenerate().catch((e) => onError(String(e)))}
            >
              Generate
            </button>
          </div>
        </label>
        <Field label="URL" value={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} />
        <label className="text-sm">
          Notes
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <Field
          label="Tags (comma-separated)"
          value={form.tags.join(", ")}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              tags: v
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }))
          }
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg0)]"
          onClick={() =>
            onSave().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
          }
        >
          Save
        </button>
        <button
          className="rounded-md border border-[var(--line)] px-4 py-2"
          onClick={onCancel}
        >
          Cancel
        </button>
        {onDelete && (
          <button
            className="ml-auto rounded-md border border-[var(--danger)]/50 px-4 py-2 text-[var(--danger)]"
            onClick={() =>
              onDelete().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
            }
          >
            Delete
          </button>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SettingsPanel({
  status,
  settings,
  setSettings,
  onBack,
  onError,
  onImported,
}: {
  status: StatusDto;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  onBack: () => void;
  onError: (e: string) => void;
  onImported: () => Promise<void>;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [importPw, setImportPw] = useState("");

  return (
    <section className="animate-rise mx-auto grid w-full max-w-2xl gap-6">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)]/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Settings</h2>
          <button className="text-sm text-[var(--muted)] hover:text-[var(--ink)]" onClick={onBack}>
            Back
          </button>
        </div>
        <p className="mt-2 break-all text-xs text-[var(--muted)]">Data directory: {status.dataDir}</p>

        <label className="mt-5 block text-sm">
          Auto-lock (seconds)
          <input
            type="number"
            min={30}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={settings.autoLockSeconds}
            onChange={(e) =>
              setSettings({ ...settings, autoLockSeconds: Number(e.target.value) || 300 })
            }
          />
        </label>
        <label className="mt-4 block text-sm">
          Clipboard clear (seconds)
          <input
            type="number"
            min={5}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={settings.clipboardClearSeconds}
            onChange={(e) =>
              setSettings({
                ...settings,
                clipboardClearSeconds: Number(e.target.value) || 30,
              })
            }
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.biometricUnlock}
            onChange={(e) => setSettings({ ...settings, biometricUnlock: e.target.checked })}
          />
          Remember unlock on this device (OS keyring)
        </label>
        <button
          className="mt-4 rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--bg0)]"
          onClick={() =>
            api
              .saveSettings(settings)
              .then(async () => {
                if (!settings.biometricUnlock) {
                  await api.clearKeyringSecret().catch(() => undefined);
                }
                onError("");
              })
              .catch((e) => onError(String(e)))
          }
        >
          Save preferences
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)]/40 p-6">
        <h3 className="font-display text-xl">Change master password</h3>
        <div className="mt-4 grid gap-3">
          <input
            type="password"
            placeholder="Current"
            className="rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
          <input
            type="password"
            placeholder="New"
            className="rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <button
            className="rounded-md border border-[var(--line)] px-4 py-2"
            onClick={() =>
              api
                .changeMasterPassword(currentPw, newPw)
                .then(() => {
                  setCurrentPw("");
                  setNewPw("");
                })
                .catch((e) => onError(String(e)))
            }
          >
            Update password
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)]/40 p-6">
        <h3 className="font-display text-xl">Import / export</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-[var(--line)] px-4 py-2"
            onClick={async () => {
              try {
                const { save } = await import("@tauri-apps/plugin-dialog");
                const dest = await save({
                  defaultPath: "keys-manager-backup.km",
                  filters: [{ name: "Vault", extensions: ["km"] }],
                });
                if (dest) await api.exportVault(dest);
              } catch (e) {
                onError(String(e));
              }
            }}
          >
            Export encrypted backup
          </button>
          <button
            className="rounded-md border border-[var(--line)] px-4 py-2"
            onClick={async () => {
              try {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const source = await open({
                  multiple: false,
                  filters: [{ name: "Vault", extensions: ["km"] }],
                });
                if (!source || Array.isArray(source)) return;
                if (!importPw) {
                  onError("Enter the backup master password below first.");
                  return;
                }
                await api.importVault(source, importPw);
                setImportPw("");
                await onImported();
              } catch (e) {
                onError(String(e));
              }
            }}
          >
            Import encrypted backup
          </button>
          <button
            className="rounded-md border border-[var(--line)] px-4 py-2"
            onClick={async () => {
              try {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const source = await open({
                  multiple: false,
                  filters: [{ name: "CSV", extensions: ["csv"] }],
                });
                if (!source || Array.isArray(source)) return;
                const text = await readFileViaFetch(source);
                const n = await api.importCsv(text);
                onError(`Imported ${n} login(s) from CSV.`);
                await onImported();
              } catch (e) {
                onError(String(e));
              }
            }}
          >
            Import CSV logins
          </button>
        </div>
        <input
          type="password"
          placeholder="Password for encrypted import"
          className="mt-3 w-full rounded-md border border-[var(--line)] bg-[var(--bg0)] px-3 py-2"
          value={importPw}
          onChange={(e) => setImportPw(e.target.value)}
        />
      </div>
    </section>
  );
}

async function readFileViaFetch(path: string): Promise<string> {
  return api.readTextFile(path);
}
