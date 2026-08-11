"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_NAV,
  type SettingsCategoryId,
  type SettingsNavItem,
  type SettingsSectionId,
} from "./types";

function matchesQuery(item: SettingsNavItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  return item.keywords.some((k) => k.toLowerCase().includes(q));
}

export function SettingsSidebar({
  active,
  onSelect,
  query,
  onQueryChange,
  compact,
  showSave,
  onSave,
  saveBusy,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  query: string;
  onQueryChange: (q: string) => void;
  compact: boolean;
  showSave: boolean;
  onSave: () => void;
  saveBusy?: boolean;
}) {
  const visibleNav = useMemo(
    () => SETTINGS_NAV.filter((item) => (!compact || !item.desktopOnly) && matchesQuery(item, query)),
    [compact, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<SettingsCategoryId, SettingsNavItem[]>();
    for (const cat of SETTINGS_CATEGORIES) map.set(cat.id, []);
    for (const item of visibleNav) {
      map.get(item.category)?.push(item);
    }
    return SETTINGS_CATEGORIES.map((cat) => ({
      ...cat,
      items: map.get(cat.id) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [visibleNav]);

  return (
    <aside className="settings-nav flex min-h-0 w-full flex-1 flex-col">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <label className="sr-only" htmlFor="settings-search">
          Search settings
        </label>
        <input
          id="settings-search"
          type="search"
          placeholder="Search…"
          className="inset-field h-9 w-full px-3 text-sm"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto scroll-region px-2 pb-3" aria-label="Settings sections">
        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">No matching settings.</p>
        ) : (
          grouped.map((group, index) => (
            <div
              key={group.id}
              className={cn(
                "settings-nav-group",
                index > 0 && "settings-nav-group--divided",
              )}
            >
              <h2 className="settings-nav-group__label">{group.label}</h2>
              <ul className="settings-nav-group__items">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="settings-nav-btn"
                      data-active={active === item.id}
                      aria-current={active === item.id ? "page" : undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      {showSave && (
        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <button
            type="button"
            className="btn-primary w-full disabled:cursor-not-allowed"
            disabled={saveBusy}
            onClick={onSave}
          >
            {saveBusy ? "Saving…" : "Save preferences"}
          </button>
        </div>
      )}
    </aside>
  );
}
