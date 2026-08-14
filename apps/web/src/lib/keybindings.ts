/**
 * Central keyboard binding registry for Clavis.
 * Chord syntax: `mod+k`, `shift+/`, `arrowup`, `enter`, `c`, …
 * `mod` = Meta (⌘) on macOS, Ctrl on Windows/Linux.
 */

export const KEYBINDING_ACTIONS = [
  "palette",
  "search",
  "newEntry",
  "lock",
  "settings",
  "shortcutsHelp",
  "listUp",
  "listDown",
  "listOpen",
  "copyLogin",
  "copyUser",
  "copyPass",
  "copyOtp",
] as const;

export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number];

export type KeybindingOverrides = Partial<Record<KeybindingAction, string>>;

/** Default chords — overrides replace the primary chord; aliases stay for list arrows. */
export const DEFAULT_KEYBINDINGS: Record<KeybindingAction, string[]> = {
  palette: ["mod+k"],
  search: ["/"],
  newEntry: ["mod+n"],
  lock: ["mod+l"],
  settings: ["mod+,"],
  shortcutsHelp: ["?"],
  listUp: ["arrowup", "k"],
  listDown: ["arrowdown", "j"],
  listOpen: ["enter"],
  copyLogin: ["c"],
  copyUser: ["u"],
  copyPass: ["p"],
  copyOtp: ["o"],
};

export const KEYBINDING_LABELS: Record<KeybindingAction, string> = {
  palette: "Command palette",
  search: "Focus search",
  newEntry: "New entry",
  lock: "Lock vault",
  settings: "Open settings",
  shortcutsHelp: "Shortcuts help",
  listUp: "List: previous entry",
  listDown: "List: next entry",
  listOpen: "List: open focused",
  copyLogin: "Copy login (user→pass)",
  copyUser: "Copy username",
  copyPass: "Copy password",
  copyOtp: "Copy TOTP code",
};

export const KEYBINDING_GROUPS: { id: string; label: string; actions: KeybindingAction[] }[] = [
  {
    id: "global",
    label: "Global",
    actions: ["palette", "search", "newEntry", "lock", "settings", "shortcutsHelp"],
  },
  {
    id: "list",
    label: "Entry list",
    actions: [
      "listUp",
      "listDown",
      "listOpen",
      "copyLogin",
      "copyUser",
      "copyPass",
      "copyOtp",
    ],
  },
];

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const plat = navigator.platform ?? "";
  const ua = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(plat) || /Mac OS X/i.test(ua);
}

export function modSymbol(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/** Normalize a chord string: lowercase, sorted modifiers, `mod` not ctrl/meta. */
export function normalizeChord(raw: string): string {
  const parts = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("+")
    .filter(Boolean);
  if (parts.length === 0) return "";

  const mods = new Set<string>();
  let key = "";
  for (const p of parts) {
    if (p === "mod" || p === "cmd" || p === "command" || p === "meta" || p === "ctrl" || p === "control") {
      if (p === "ctrl" || p === "control") {
        // Keep explicit ctrl separate from mod only if we want — treat as mod for storage
        mods.add("mod");
      } else {
        mods.add("mod");
      }
    } else if (p === "alt" || p === "option") {
      mods.add("alt");
    } else if (p === "shift") {
      mods.add("shift");
    } else {
      key = p === " " ? "space" : p;
    }
  }
  if (!key) return "";
  const order = ["mod", "alt", "shift"];
  const prefix = order.filter((m) => mods.has(m));
  return [...prefix, key].join("+");
}

export function resolveBindings(
  overrides?: KeybindingOverrides | Record<string, string> | null,
): Record<KeybindingAction, string[]> {
  const out = {} as Record<KeybindingAction, string[]>;
  for (const action of KEYBINDING_ACTIONS) {
    const def = DEFAULT_KEYBINDINGS[action];
    const ov = overrides?.[action];
    if (ov && typeof ov === "string" && ov.trim()) {
      const primary = normalizeChord(ov);
      // Keep non-overridden aliases (e.g. j/k with arrow overrides)
      const aliases = def.slice(1).filter((c) => c !== primary);
      out[action] = primary ? [primary, ...aliases] : [...def];
    } else {
      out[action] = [...def];
    }
  }
  return out;
}

export function formatChord(chord: string): string {
  const n = normalizeChord(chord);
  if (!n) return "";
  const parts = n.split("+");
  const mac = isMac();
  return parts
    .map((p) => {
      if (p === "mod") return mac ? "⌘" : "Ctrl";
      if (p === "alt") return mac ? "⌥" : "Alt";
      if (p === "shift") return mac ? "⇧" : "Shift";
      if (p === "arrowup") return "↑";
      if (p === "arrowdown") return "↓";
      if (p === "arrowleft") return "←";
      if (p === "arrowright") return "→";
      if (p === "enter") return "Enter";
      if (p === "escape") return "Esc";
      if (p === "space") return "Space";
      if (p === ",") return ",";
      if (p.length === 1) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(mac ? "" : "+");
}

export function primaryChord(
  action: KeybindingAction,
  overrides?: KeybindingOverrides | Record<string, string> | null,
): string {
  return resolveBindings(overrides)[action][0] ?? "";
}

export function formatActionChord(
  action: KeybindingAction,
  overrides?: KeybindingOverrides | Record<string, string> | null,
): string {
  return formatChord(primaryChord(action, overrides));
}

export function formatChords(chords: string[]): string {
  return chords.map(formatChord).filter(Boolean).join(" / ");
}

function eventKeyToken(e: KeyboardEvent): string {
  const k = e.key;
  if (k === " ") return "space";
  if (k.length === 1) return k.toLowerCase();
  return k.toLowerCase();
}

/** Build a normalized chord from a KeyboardEvent (for matching and capture). */
export function eventToChord(e: KeyboardEvent): string {
  const key = eventKeyToken(e);
  if (key === "shift" || key === "control" || key === "meta" || key === "alt") {
    return "";
  }
  const mods: string[] = [];
  const mac = isMac();
  const modPressed = mac ? e.metaKey : e.ctrlKey;
  // On Mac, Ctrl alone is rare for our bindings; still record as mod if either primary
  if (modPressed || (mac && e.metaKey) || (!mac && e.ctrlKey)) {
    mods.push("mod");
  }
  // If user presses the "other" modifier (Ctrl on Mac / Meta on Win), include as mod too for capture
  if (mac && e.ctrlKey && !e.metaKey) {
    // treat Ctrl on Mac as mod for capture compatibility
    if (!mods.includes("mod")) mods.push("mod");
  }
  if (e.altKey) mods.push("alt");
  if (e.shiftKey && key.length !== 1) {
    // shift+/ produces ? — key already reflects that
  } else if (e.shiftKey && !/[a-z0-9]/.test(key) && key !== "?" && key !== "/") {
    mods.push("shift");
  } else if (e.shiftKey && key.length > 1) {
    mods.push("shift");
  }
  return normalizeChord([...mods, key].join("+"));
}

export function eventMatchesChord(e: KeyboardEvent, chord: string): boolean {
  const want = normalizeChord(chord);
  if (!want) return false;

  const parts = want.split("+");
  const key = parts[parts.length - 1]!;
  const needMod = parts.includes("mod");
  const needAlt = parts.includes("alt");
  const needShift = parts.includes("shift");

  const mac = isMac();
  const modDown = mac ? e.metaKey : e.ctrlKey;

  if (needMod !== modDown) return false;
  // Reject the opposite platform mod when chord doesn't want mod
  if (!needMod && (mac ? e.ctrlKey : e.metaKey) && key.length === 1) {
    /* allow lone letter even if secondary mod held */
  }
  if (needAlt !== e.altKey) return false;
  if (needShift && !e.shiftKey) return false;
  if (!needShift && e.shiftKey && key.length > 1 && key !== "?" && key !== "/") {
    return false;
  }

  return eventKeyToken(e) === key;
}

export function matchAction(
  e: KeyboardEvent,
  overrides?: KeybindingOverrides | Record<string, string> | null,
): KeybindingAction | null {
  const resolved = resolveBindings(overrides);
  for (const action of KEYBINDING_ACTIONS) {
    for (const chord of resolved[action]) {
      if (eventMatchesChord(e, chord)) return action;
    }
  }
  return null;
}

export function findConflict(
  action: KeybindingAction,
  chord: string,
  overrides?: KeybindingOverrides | Record<string, string> | null,
): KeybindingAction | null {
  const n = normalizeChord(chord);
  if (!n) return null;
  const resolved = resolveBindings(overrides);
  for (const other of KEYBINDING_ACTIONS) {
    if (other === action) continue;
    if (resolved[other].some((c) => normalizeChord(c) === n)) return other;
  }
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
