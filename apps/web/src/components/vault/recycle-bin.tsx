"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type EntrySummary } from "@/lib/api";
import { appConfirm } from "@/lib/app-dialogs";

export function RecycleBinPanel({
  open,
  onClose,
  onChanged,
  onError,
  retainDays,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onError: (e: string) => void;
  retainDays: number;
}) {
  const [items, setItems] = useState<EntrySummary[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await api.listDeletedEntries();
    setItems(list);
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh().catch((e) => onError(String(e)));
  }, [open, refresh, onError]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="animate-rise flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg"
        role="dialog"
        aria-label="Recycle bin"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="font-display text-lg">Recycle bin</h3>
            <p className="text-xs text-[var(--muted)]">
              Soft-deleted entries stay decryptable while unlocked. Auto-purge after {retainDays}{" "}
              days.
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

        <div className="min-h-0 flex-1 overflow-y-auto scroll-region p-3">
          {items.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-[var(--muted)]">Bin is empty.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title || "(untitled)"}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {[e.workspaceName, e.username || e.url].filter(Boolean).join(" · ")}
                    </p>
                    {e.deletedAt && (
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Deleted {new Date(e.deletedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--inset)]"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.restoreEntry(e.id);
                          await refresh();
                          await onChanged();
                        } catch (err) {
                          onError(String(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--inset)]"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await appConfirm({
                          title: "Permanently delete?",
                          description: `Remove “${e.title}” forever? This cannot be undone.`,
                          danger: true,
                        });
                        if (!ok) return;
                        setBusy(true);
                        try {
                          await api.purgeEntry(e.id);
                          await refresh();
                          await onChanged();
                        } catch (err) {
                          onError(String(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Delete forever
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
            <button
              type="button"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-red-600 hover:bg-[var(--inset)]"
              disabled={busy}
              onClick={async () => {
                const ok = await appConfirm({
                  title: "Empty recycle bin?",
                  description: `Permanently delete ${items.length} entr${items.length === 1 ? "y" : "ies"}?`,
                  danger: true,
                });
                if (!ok) return;
                setBusy(true);
                try {
                  await api.emptyTrash();
                  await refresh();
                  await onChanged();
                } catch (err) {
                  onError(String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Empty bin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
