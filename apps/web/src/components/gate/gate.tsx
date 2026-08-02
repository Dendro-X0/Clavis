"use client";

import { useEffect, useState } from "react";
import { api, type StatusDto } from "@/lib/api";
import { biometricAuthenticate, biometricStatus } from "@/lib/biometric";

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
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const missing = status?.state === "missing";

  useEffect(() => {
    if (missing) return;
    let cancelled = false;

    (async () => {
      let enabled = false;
      try {
        const s = await api.getSettings();
        enabled = Boolean(s.biometricUnlock);
        if (!cancelled) setBioEnabled(enabled);
      } catch {
        /* ignore */
      }

      // Convenience unlock is opt-in via Settings only (off by default).
      if (!enabled) return;

      const bio = await biometricStatus();
      if (cancelled) return;
      setBioAvailable(bio.available);

      // Mobile with biometrics: wait for explicit button. Desktop / no bio: silent keyring try.
      if (bio.available) return;

      try {
        await api.tryKeyringUnlock();
        if (!cancelled) await onDone();
      } catch {
        /* password fallback */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missing, onDone]);

  async function unlockWithBiometrics() {
    setBioBusy(true);
    onError("");
    try {
      await biometricAuthenticate("Unlock your Clavis vault");
      await api.tryKeyringUnlock();
      await onDone();
    } catch (e) {
      onError(
        String(e).replace(/^Error:\s*/, "") ||
          "Biometric unlock failed. Use your master password.",
      );
    } finally {
      setBioBusy(false);
    }
  }

  const showBio = !missing && bioEnabled && bioAvailable;

  return (
    <section className="animate-rise mx-auto w-full max-w-md panel p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <h2 className="font-display text-2xl">
        {missing ? "Create your vault" : "Unlock"}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {missing
          ? "Clavis stores an encrypted vault next to the app. Your master password never leaves this device."
          : showBio
            ? "Unlock with biometrics, or enter your master password."
            : "Enter your master password to decrypt the local vault."}
      </p>

      {missing && (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-[var(--muted)]">
          <li>Name the vault (optional label).</li>
          <li>Choose a strong master password (8+ characters).</li>
          <li>
            After unlock: import a file or add an entry, then use{" "}
            <span className="text-[var(--foreground)]">Copy</span> to paste into logins.
          </li>
        </ol>
      )}

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

      {showBio && (
        <button
          type="button"
          disabled={bioBusy}
          className="mt-6 w-full rounded-md bg-[var(--primary)] py-2.5 font-medium text-[var(--primary-fg)] hover:opacity-90 disabled:opacity-60"
          onClick={() => void unlockWithBiometrics()}
        >
          {bioBusy ? "Waiting for biometrics…" : "Unlock with biometrics"}
        </button>
      )}

      <label className="mt-4 block text-sm">
        Master password
        <input
          type="password"
          className="inset-field mt-1 w-full px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={!showBio}
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

      <button
        type="button"
        className={
          showBio
            ? "mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--inset)] py-2.5 font-medium text-[var(--foreground)] hover:bg-[var(--accent-wash)]"
            : "mt-6 w-full rounded-md bg-[var(--primary)] py-2.5 font-medium text-[var(--primary-fg)] hover:opacity-90"
        }
        onClick={async () => {
          try {
            if (missing) {
              if (password.length < 8) throw new Error("Use at least 8 characters.");
              if (password !== confirm) throw new Error("Passwords do not match.");
              await api.createVault(name || "Personal", password);
              try {
                localStorage.setItem("clavis_show_onboarding", "1");
              } catch {
                /* ignore */
              }
            } else {
              await api.unlock(password);
            }
            setPassword("");
            setConfirm("");
            await onDone();
          } catch (e) {
            onError(String(e).replace(/^Error:\s*/, ""));
          }
        }}
      >
        {missing ? "Create vault" : showBio ? "Unlock with password" : "Unlock"}
      </button>

      {!missing && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          Biometric / keyring unlock is off by default. Enable it in Settings after unlock.
        </p>
      )}

      {status?.dataDir && (
        <p className="mt-4 break-all text-xs text-[var(--muted)]">Data: {status.dataDir}</p>
      )}
    </section>
  );
}
