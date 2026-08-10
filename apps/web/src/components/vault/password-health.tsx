"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type HealthFinding,
  type HealthFindingKind,
  type HealthReport,
} from "@/lib/api";
import { ModalShell } from "@/components/ui/modal-shell";

const KIND_LABEL: Record<HealthFindingKind, string> = {
  empty: "Empty password",
  short: "Too short",
  weak_charset: "Weak character mix",
  reused: "Reused password",
  common: "Common password",
  breached: "Found in breach data",
};

export function PasswordHealthPanel({
  open,
  onClose,
  onOpenEntry,
  onError,
  allowNetwork,
  checkBreaches,
}: {
  open: boolean;
  onClose: () => void;
  onOpenEntry: (id: string, workspaceId?: string) => void;
  onError: (e: string) => void;
  allowNetwork: boolean;
  checkBreaches: boolean;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState(false);
  const [breachIds, setBreachIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [breachBusy, setBreachBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const next = await api.passwordHealthReport({ allWorkspaces });
      setReport(next);
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }, [allWorkspaces, onError]);

  useEffect(() => {
    if (!open) {
      setReport(null);
      setBreachIds(new Set());
      return;
    }
    refresh().catch(() => undefined);
  }, [open, refresh]);

  if (!open) return null;

  const findings: HealthFinding[] = [
    ...(report?.findings ?? []),
    ...[...breachIds].map(
      (id): HealthFinding => {
        const base = report?.findings.find((f) => f.entryId === id);
        return {
          entryId: id,
          title: base?.title ?? id.slice(0, 8),
          workspaceId: base?.workspaceId ?? "",
          workspaceName: base?.workspaceName ?? "",
          kind: "breached",
          severity: "high",
        };
      },
    ),
  ];

  // Deduplicate breached if already present
  const seen = new Set<string>();
  const display = findings.filter((f) => {
    const key = `${f.entryId}:${f.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <ModalShell open={open} onClose={onClose} label="Password health">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="font-display text-lg">Password health</h3>
            <p className="text-xs text-[var(--muted)]">
              Local checks only by default. Findings never include password text.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allWorkspaces}
              onChange={(e) => setAllWorkspaces(e.target.checked)}
            />
            All workspaces
          </label>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)]"
            disabled={busy}
            onClick={() => refresh().catch((e) => onError(String(e)))}
          >
            {busy ? "Scanning…" : "Rescan"}
          </button>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)] disabled:opacity-40"
            disabled={breachBusy || !allowNetwork || !checkBreaches}
            title={
              !allowNetwork || !checkBreaches
                ? "Enable Network + Check breaches in Settings"
                : "One-shot HIBP k-anonymity check"
            }
            onClick={async () => {
              setBreachBusy(true);
              try {
                const ids = await api.checkVaultBreaches({ allWorkspaces });
                setBreachIds(new Set(ids));
              } catch (e) {
                onError(String(e).replace(/^Error:\s*/, ""));
              } finally {
                setBreachBusy(false);
              }
            }}
          >
            {breachBusy ? "Checking…" : "Check breaches"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-region p-3">
          {report && (
            <p className="mb-2 px-1 text-xs text-[var(--muted)]">
              Scored {report.scoredEntries} entr{report.scoredEntries === 1 ? "y" : "ies"}
              {report.workspaceScoped ? " in active workspace" : " across workspaces"}. Trash
              excluded.
            </p>
          )}
          {display.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-[var(--muted)]">
              {busy ? "Scanning…" : "No issues found."}
            </p>
          ) : (
            <ul className="space-y-2">
              {display.map((f) => (
                <li key={`${f.entryId}:${f.kind}`}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--inset)]"
                    onClick={() => {
                      onOpenEntry(f.entryId, f.workspaceId || undefined);
                      onClose();
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.title || "(untitled)"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {KIND_LABEL[f.kind]}
                        {f.workspaceName ? ` · ${f.workspaceName}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        f.severity === "high"
                          ? "shrink-0 text-[10px] uppercase tracking-wide text-[var(--danger)]"
                          : "shrink-0 text-[10px] uppercase tracking-wide text-amber-600"
                      }
                    >
                      {f.severity}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </ModalShell>
  );
}
