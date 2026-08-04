import { isTauri, invoke } from "./tauri";

export type VaultState = "missing" | "locked" | "unlocked";

export type StatusDto = {
  state: VaultState;
  entryCount?: number | null;
  name?: string | null;
  dataDir: string;
  /** True when vault.km hash differs from last trusted unlock. */
  vaultFingerprintChanged?: boolean;
};

export type EntryType = "login" | "note" | "api" | "custom";

export type EntrySummary = {
  id: string;
  entryType: EntryType;
  title: string;
  username: string;
  url: string;
  tags: string[];
  customFields?: CustomField[];
  hasOtp?: boolean;
  updatedAt: string;
  workspaceId?: string;
  workspaceName?: string;
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
  otp_secret?: string;
  otpSecret?: string;
  custom_fields?: CustomField[];
  customFields?: CustomField[];
  tags: string[];
  created_at?: string;
  updated_at?: string;
};

export type AppSettings = {
  autoLockSeconds: number;
  clipboardClearSeconds: number;
  biometricUnlock: boolean;
  theme: "light" | "dark" | "system";
  entryLayout: "list" | "grid";
  pageSize: 10 | 25 | 50 | 100;
  pinnedWorkspaceIds?: string[];
  fetchFavicons?: boolean;
  /** Master outbound HTTP gate. Default false. */
  allowNetwork?: boolean;
  /** Lock when the window/tab is hidden. Default true. */
  lockOnHide?: boolean;
  /** Encrypted vault fingerprint (integrity signal). */
  lastVaultSha256?: string | null;
};

export type VaultCryptoInfo = {
  algorithm: string;
  aead: string;
  version: number;
  mCost: number;
  tCost: number;
  pCost: number;
};

export function formatVaultCryptoInfo(info: VaultCryptoInfo): string {
  const mib = (info.mCost / 1024).toFixed(info.mCost % 1024 === 0 ? 0 : 1);
  return `${info.algorithm.toUpperCase()} · ${mib} MiB · t=${info.tCost} · p=${info.pCost} · ${info.aead.toUpperCase()} · format v${info.version}`;
}

export function isWeakerThanDefaults(info: VaultCryptoInfo, defaults: VaultCryptoInfo): boolean {
  return info.mCost < defaults.mCost || info.tCost < defaults.tCost || info.pCost < defaults.pCost;
}

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
  otpSecret: string;
};

export type TotpCodeDto = {
  code: string;
  secondsRemaining: number;
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

export type ImportResult = {
  count: number;
  workspaceId: string;
  workspaceName: string;
  replaced: boolean;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  entryCount: number;
  sourceFile?: string | null;
  active: boolean;
};

export type ImportMode = "new" | "replace";

export type DataDirInfo = {
  path: string;
  portable: boolean;
  appRoot?: string;
};

export const api = {
  status: () => call<StatusDto>("vault_status").catch(() => browserFallback),
  getDataDir: () => call<string>("get_data_dir"),
  getDataDirInfo: () => call<DataDirInfo>("get_data_dir_info"),
  setDataDir: (path: string | null) => call<DataDirInfo>("set_data_dir", { path }),
  makeDataDirPortable: (overwrite: boolean) =>
    call<DataDirInfo>("make_data_dir_portable", { overwrite }),
  pickDataDir: () => call<string | null>("pick_data_dir"),
  createVault: (name: string, password: string) =>
    call<StatusDto>("create_vault", { name, password }),
  unlock: (password: string) => call<StatusDto>("unlock", { password }),
  tryKeyringUnlock: () => call<StatusDto>("try_keyring_unlock"),
  storeKeyringSecret: (password: string) => call<void>("store_keyring_secret", { password }),
  clearKeyringSecret: () => call<void>("clear_keyring_secret"),
  lock: () => call<void>("lock"),
  listEntries: () => call<EntrySummary[]>("list_entries"),
  listAllEntries: () => call<EntrySummary[]>("list_all_entries"),
  listWorkspaces: () => call<WorkspaceSummary[]>("list_workspaces"),
  setActiveWorkspace: (id: string) => call<WorkspaceSummary[]>("set_active_workspace", { id }),
  createWorkspace: (name: string) => call<WorkspaceSummary>("create_workspace", { name }),
  renameWorkspace: (id: string, name: string) =>
    call<WorkspaceSummary[]>("rename_workspace", { id, name }),
  deleteWorkspace: (id: string) => call<WorkspaceSummary[]>("delete_workspace", { id }),
  mergeDuplicateWorkspaces: () =>
    call<{ removed: number; workspaces: WorkspaceSummary[] }>("merge_duplicate_workspaces"),
  getEntry: (id: string) => call<Entry>("get_entry", { id }),
  entryTotpCode: (id: string) => call<TotpCodeDto>("entry_totp_code", { id }),
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
        otpSecret: input.otpSecret,
      },
    }),
  deleteEntry: (id: string) => call<void>("delete_entry", { id }),
  exportVault: (dest: string) => call<void>("export_vault", { dest }),
  importVault: (source: string, password: string) =>
    call<StatusDto>("import_vault", { source, password }),
  importCsv: (csvText: string, mode: ImportMode = "new", workspaceName?: string, workspaceId?: string) =>
    call<ImportResult>("import_csv", { csvText, mode, workspaceName, workspaceId }),
  importCredentialsFile: (path: string, mode: ImportMode = "new", workspaceId?: string) =>
    call<ImportResult>("import_credentials_file", { path, mode, workspaceId }),
  importCredentialsText: (
    text: string,
    mode: ImportMode = "new",
    workspaceName?: string,
    workspaceId?: string,
  ) => call<ImportResult>("import_credentials_text", { text, mode, workspaceName, workspaceId }),
  pickOpenPath: (kind: "vault" | "csv" | "credentials" | string) =>
    call<string | null>("pick_open_path", { kind }),
  pickSavePath: (defaultName?: string) =>
    call<string | null>("pick_save_path", { defaultName }),
  changeMasterPassword: (current: string, newPassword: string) =>
    call<void>("change_master_password", { current, newPassword }),
  vaultCryptoInfo: () => call<VaultCryptoInfo>("vault_crypto_info"),
  peekVaultKdf: (path: string) => call<VaultCryptoInfo>("peek_vault_kdf", { path }),
  defaultVaultKdf: () => call<VaultCryptoInfo>("default_vault_kdf"),
  upgradeVaultKdf: (password: string) => call<VaultCryptoInfo>("upgrade_vault_kdf", { password }),
  getSettings: () => call<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => call<void>("save_settings", { settings }),
  generatePassword: (length = 20) => call<string>("generate_password", { length }),
  readTextFile: (path: string) => call<string>("read_text_file", { path }),
  readEntryIcon: (host: string) => call<string | null>("read_entry_icon", { host }),
  fetchEntryIcon: (host: string) => call<string | null>("fetch_entry_icon", { host }),
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
    otpSecret: e.otpSecret ?? e.otp_secret ?? "",
  };
}
