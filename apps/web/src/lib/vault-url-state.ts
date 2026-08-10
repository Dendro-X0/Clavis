import {
  SETTINGS_NAV,
  type SettingsSectionId,
} from "@/components/shell/settings/types";

/** Mirrors sidebar `NavId` without importing the React module. */
export type VaultNavId = "all" | "login" | "note" | "api" | "custom" | "settings";

export type VaultUrlState = {
  nav: VaultNavId;
  query: string;
  tag: string | null;
  page: number;
  section: SettingsSectionId;
};

const NAV_IDS = new Set<VaultNavId>(["all", "login", "note", "api", "custom", "settings"]);
const SECTION_IDS = new Set<SettingsSectionId>(SETTINGS_NAV.map((n) => n.id));

export const DEFAULT_VAULT_URL: VaultUrlState = {
  nav: "all",
  query: "",
  tag: null,
  page: 1,
  section: "appearance",
};

function isNavId(value: string): value is VaultNavId {
  return NAV_IDS.has(value as VaultNavId);
}

function isSectionId(value: string): value is SettingsSectionId {
  return SECTION_IDS.has(value as SettingsSectionId);
}

/** Parse location.hash (`#nav=login&q=…`) into vault UI state. */
export function parseVaultHash(hash: string): VaultUrlState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const navRaw = params.get("nav") ?? "all";
  const sectionRaw = params.get("section") ?? "appearance";
  const pageRaw = Number.parseInt(params.get("page") ?? "1", 10);
  const tagRaw = params.get("tag");
  return {
    nav: isNavId(navRaw) ? navRaw : "all",
    query: params.get("q") ?? "",
    tag: tagRaw && tagRaw.trim() ? tagRaw.trim() : null,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    section: isSectionId(sectionRaw) ? sectionRaw : "appearance",
  };
}

/** Serialize vault UI state to a hash string (including `#`). Empty when defaults. */
export function serializeVaultHash(state: VaultUrlState): string {
  const params = new URLSearchParams();
  if (state.nav !== "all") params.set("nav", state.nav);
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.tag?.trim()) params.set("tag", state.tag.trim());
  if (state.page > 1) params.set("page", String(state.page));
  if (state.nav === "settings") {
    params.set("section", state.section);
  }
  const qs = params.toString();
  return qs ? `#${qs}` : "";
}

export function readVaultUrlFromLocation(): VaultUrlState {
  if (typeof window === "undefined") return DEFAULT_VAULT_URL;
  return parseVaultHash(window.location.hash);
}

export function writeVaultUrlToLocation(state: VaultUrlState) {
  if (typeof window === "undefined") return;
  const next = serializeVaultHash(state);
  const current = window.location.hash || "";
  if (next === current || (next === "" && current === "")) return;
  const url = `${window.location.pathname}${window.location.search}${next}`;
  window.history.replaceState(
    window.history.state,
    "",
    url || `${window.location.pathname}${window.location.search}`,
  );
}
