"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type MatchCandidate } from "@/lib/api";

export function ForegroundSuggestions({
  enabled,
  onOpenEntry,
  onAutotypeLogin,
  autotypeEnabled,
  onError,
}: {
  enabled: boolean;
  onOpenEntry: (id: string, workspaceId?: string) => void;
  onAutotypeLogin?: (id: string) => void;
  autotypeEnabled?: boolean;
  onError: (e: string) => void;
}) {
  const [items, setItems] = useState<MatchCandidate[]>([]);
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setTitle("");
      return;
    }
    try {
      const info = await api.getForegroundWindowInfo();
      setTitle(info.supported ? info.title : "");
      if (!info.supported || !info.title.trim()) {
        setItems([]);
        return;
      }
      const ranked = await api.suggestEntriesForForeground();
      setItems(ranked);
    } catch (e) {
      // Soft-fail — don't spam while locked mid-poll.
      if (String(e).includes("locked")) {
        setItems([]);
      } else {
        onError(String(e).replace(/^Error:\s*/, ""));
      }
    }
  }, [enabled, onError]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    refresh().catch(() => undefined);
    const t = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(t);
  }, [enabled, refresh]);

  if (!enabled || items.length === 0) return null;

  return (
    <div className="mb-3 shrink-0 rounded-md border border-[var(--border)] bg-[var(--inset)]/50 px-3 py-2">
      <p className="truncate text-[10px] tracking-wide text-[var(--muted)] uppercase">
        Matches for “{title || "foreground"}”
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.entryId} className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs hover:bg-[var(--accent-wash)]"
              onClick={() => onOpenEntry(c.entryId, c.workspaceId)}
              title={c.url || c.username}
            >
              {c.title || "(untitled)"}
            </button>
            {autotypeEnabled && onAutotypeLogin && (
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => onAutotypeLogin(c.entryId)}
              >
                Type
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
