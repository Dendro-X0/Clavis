export const SKIN_IDS = ["seafoam", "graphite"] as const;

export type AppSkin = (typeof SKIN_IDS)[number];

export const SKIN_LABELS: Record<AppSkin, string> = {
  seafoam: "Seafoam",
  graphite: "Graphite",
};

export const SKIN_STORAGE_KEY = "clavis-skin";

export function normalizeSkin(value: string | undefined | null): AppSkin {
  if (value === "graphite") return "graphite";
  return "seafoam";
}

export function applyDocumentSkin(skin: AppSkin) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.skin = skin;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch {
    /* private mode */
  }
}

export function readStoredSkin(): AppSkin {
  if (typeof window === "undefined") return "seafoam";
  try {
    return normalizeSkin(localStorage.getItem(SKIN_STORAGE_KEY));
  } catch {
    return "seafoam";
  }
}
