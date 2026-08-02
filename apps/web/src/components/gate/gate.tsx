"use client";

import { useEffect, useState } from "react";
import { api, type StatusDto } from "@/lib/api";

export function Gate({
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
    <section className="animate-rise mx-auto w-full max-w-md panel p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <h2 className="font-display text-2xl">
        {missing ? "Create your vault" : "Unlock"}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {missing
          ? "Choose a strong master password. It never leaves this device."
          : "Enter your master password to decrypt the local vault."}
      </p>

      {missing && (
        <label className="mt-5 block text-sm">
          Vault name
          <input
            className="inset-field mt-1 w-full px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <label className="mt-4 block text-sm">
        Master password
        <input
          type="password"
          className="inset-field mt-1 w-full px-3 py-2"
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
            className="inset-field mt-1 w-full px-3 py-2"
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
        className="mt-6 w-full rounded-md bg-[var(--primary)] py-2.5 font-medium text-[var(--primary-fg)] hover:opacity-90"
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
