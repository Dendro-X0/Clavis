import { isTauri, invoke } from "./tauri";

export type VaultState = "missing" | "locked" | "unlocked";

export type StatusDto = {
  state: VaultState;
  entryCount?: number | null;
  name?: string | null;
  dataDir: string;
};

export type EntryType = "login" | "note" | "api" | "custom";

export type EntrySummary = {
  id: string;
  entryType: EntryType;
  title: string;
  username: string;
  url: string;
  tags: string[];
  updatedAt: string;
};

export type CustomField = { label: string; value: string };

export type Entry = {
  id: string;
  entry_type?: EntryType;
  entryType?: EntryType;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  custom_fields?: CustomField[];
  customFields?: CustomField[];
  tags: string[];
  created_at?: string;
  updated_at?: string;
};

export type AppSettings = {
  autoLockSeconds: number;
  clipboardClearSeconds: number;
  biometricUnlock: boolish;
};

type boolish = boolean;

export type UpsertEntryInput = {
  id?: string;
  entryType: EntryType;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  customFields: CustomField[];
};

const browserFallback: StatusDto = {
  state: "missing",
  dataDir: "(open inside the desktop app)",
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!(await isTauri())) {
    throw new Error("Keys Manager runs inside the Tauri desktop shell.");
  }
  return invoke<T>(cmd, args);
}

export const api = {
  status: () => call<StatusDto>("vault_status").catch(() => browserFallback),
  getDataDir: () => call<string>("get_data_dir"),
  createVault: (name: string, password: string) =>
    call<StatusDto>("create_vault", { name, password }),
  unlock: (password: string) => call<StatusDto>("unlock", { password }),
  tryKeyringUnlock: () => call<StatusDto>("try_keyring_unlock"),
  storeKeyringSecret: (password: string) => call<void>("store_keyring_secret", { password }),
  clearKeyringSecret: () => call<void>("clear_keyring_secret"),
  lock: () => call<void>("lock"),
  listEntries: () => call<EntrySummary[]>("list_entries"),
  getEntry: (id: string) => call<Entry>("get_entry", { id }),
  upsertEntry: (input: UpsertEntryInput) =>
    call<Entry>("upsert_entry", {
      input: {
        id: input.id,
        entryType: input.entryType,
        title: input.title,
        username: input.username,
        password: input.password,
        url: input.url,
        notes: input.notes,
        tags: input.tags,
        customFields: input.customFields,
      },
    }),
  deleteEntry: (id: string) => call<void>("delete_entry", { id }),
  exportVault: (dest: string) => call<void>("export_vault", { dest }),
  importVault: (source: string, password: string) =>
    call<StatusDto>("import_vault", { source, password }),
  importCsv: (csvText: string) => call<number>("import_csv", { csvText }),
  changeMasterPassword: (current: string, newPassword: string) =>
    call<void>("change_master_password", { current, newPassword }),
  getSettings: () => call<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => call<void>("save_settings", { settings }),
  generatePassword: (length = 20) => call<string>("generate_password", { length }),
  readTextFile: (path: string) => call<string>("read_text_file", { path }),
};

export function normalizeEntry(e: Entry) {
  return {
    id: e.id,
    entryType: (e.entryType ?? e.entry_type ?? "login") as EntryType,
    title: e.title,
    username: e.username ?? "",
    password: e.password ?? "",
    url: e.url ?? "",
    notes: e.notes ?? "",
    tags: e.tags ?? [],
    customFields: e.customFields ?? e.custom_fields ?? [],
  };
}
