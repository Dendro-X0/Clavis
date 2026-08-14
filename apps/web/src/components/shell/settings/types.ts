export type SettingsSectionId =
  | "appearance"
  | "keyboard"
  | "lock-clipboard"
  | "convenience-unlock"
  | "master-password"
  | "portable-data"
  | "snapshots"
  | "recycle-bin"
  | "network"
  | "desktop-fill"
  | "workspaces"
  | "import-export";

export type SettingsCategoryId = "general" | "security" | "data" | "network" | "desktop" | "vault";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  category: SettingsCategoryId;
  keywords: string[];
  /** Hide on compact / mobile surfaces. */
  desktopOnly?: boolean;
};

export const SETTINGS_CATEGORIES: { id: SettingsCategoryId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "security", label: "Security" },
  { id: "data", label: "Data" },
  { id: "network", label: "Network" },
  { id: "desktop", label: "Desktop" },
  { id: "vault", label: "Vault" },
];

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: "appearance",
    label: "Appearance",
    category: "general",
    keywords: ["theme", "light", "dark", "system", "skin", "color", "seafoam", "graphite", "layout", "grid", "list", "page", "size"],
  },
  {
    id: "keyboard",
    label: "Keyboard",
    category: "general",
    keywords: [
      "shortcut",
      "hotkey",
      "keybinding",
      "keymap",
      "ctrl",
      "cmd",
      "mod",
      "palette",
    ],
  },
  {
    id: "lock-clipboard",
    label: "Lock & clipboard",
    category: "security",
    keywords: ["auto-lock", "idle", "hide", "clipboard", "clear", "seconds", "never"],
  },
  {
    id: "convenience-unlock",
    label: "Convenience unlock",
    category: "security",
    keywords: ["biometric", "keyring", "password", "unlock", "os"],
  },
  {
    id: "master-password",
    label: "Master password",
    category: "security",
    keywords: ["change", "password", "master", "rotate"],
  },
  {
    id: "portable-data",
    label: "Data folder",
    category: "data",
    keywords: ["portable", "usb", "data", "directory", "folder", "path"],
    desktopOnly: true,
  },
  {
    id: "snapshots",
    label: "Snapshots",
    category: "data",
    keywords: ["backup", "restore", "snapshot", "vault.km", "retain"],
  },
  {
    id: "recycle-bin",
    label: "Recycle bin",
    category: "data",
    keywords: ["trash", "soft-delete", "purge", "retain", "days"],
  },
  {
    id: "network",
    label: "Network",
    category: "network",
    keywords: ["offline", "http", "favicon", "hibp", "breach", "icons"],
  },
  {
    id: "desktop-fill",
    label: "Desktop fill",
    category: "desktop",
    keywords: ["autotype", "sendinput", "windows", "foreground", "type"],
    desktopOnly: true,
  },
  {
    id: "workspaces",
    label: "Workspaces",
    category: "vault",
    keywords: ["workspace", "rename", "delete", "merge", "import"],
  },
  {
    id: "import-export",
    label: "Import & export",
    category: "vault",
    keywords: ["export", "import", "backup", "csv", "kdf", "encrypted", "km"],
  },
];

export const SETTINGS_SECTION_META: Record<
  SettingsSectionId,
  { title: string; description: string }
> = {
  appearance: {
    title: "Appearance",
    description: "Theme, color scheme (skin), entry layout, and pagination defaults.",
  },
  keyboard: {
    title: "Keyboard",
    description: "View and remap shortcuts. Mod is ⌘ on macOS and Ctrl on Windows/Linux.",
  },
  "lock-clipboard": {
    title: "Lock & clipboard",
    description: "Idle auto-lock, lock-on-hide, and clipboard auto-clear timing.",
  },
  "convenience-unlock": {
    title: "Convenience unlock",
    description: "Optional OS keyring storage for faster unlock on trusted devices.",
  },
  "master-password": {
    title: "Master password",
    description: "Change the password that encrypts your vault.",
  },
  "portable-data": {
    title: "Data folder",
    description:
      "Portable kit vs custom/synced path — keep vault.km and attachments/ together (no Clavis cloud).",
  },
  snapshots: {
    title: "Snapshots",
    description: "Dated encrypted copies of vault.km for local rollback.",
  },
  "recycle-bin": {
    title: "Recycle bin",
    description: "How long soft-deleted entries are kept before auto-purge.",
  },
  network: {
    title: "Network",
    description: "Offline-first outbound HTTP gates and optional online features.",
  },
  "desktop-fill": {
    title: "Desktop fill",
    description: "Opt-in Windows autotype and foreground title suggestions.",
  },
  workspaces: {
    title: "Workspaces",
    description: "Rename, delete, or merge imported workspace containers.",
  },
  "import-export": {
    title: "Import & export",
    description: "Encrypted backups, credential imports, and KDF upgrades.",
  },
};
