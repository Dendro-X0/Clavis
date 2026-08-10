import { isTauri, invoke } from "./tauri";

export function normalizeTheme(value: string | undefined): AppSettings["theme"] {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function normalizeEntryLayout(value: string | undefined): AppSettings["entryLayout"] {
  return value === "grid" ? "grid" : "list";
}

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
  /** Unlocked list payload for client search. */
  notes?: string;
  hasOtp?: boolean;
  updatedAt: string;
  deletedAt?: string | null;
  workspaceId?: string;
  workspaceName?: string;
};

export type NotesFormat = "plain" | "markdown";

export type AttachmentMeta = {
  id: string;
  name: string;
  mime?: string;
  size: number;
  created_at?: string;
  createdAt?: string;
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
  notes_format?: NotesFormat;
  notesFormat?: NotesFormat;
  otp_secret?: string;
  otpSecret?: string;
  custom_fields?: CustomField[];
  customFields?: CustomField[];
  tags: string[];
  attachments?: AttachmentMeta[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  deletedAt?: string | null;
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
  /** Soft-delete retain window (days). Default 30. */
  trashRetainDays?: number;
  /** Opt-in HIBP k-anonymity (also requires allowNetwork). Default false. */
  checkBreaches?: boolean;
  /** Desktop confirm-gated SendInput autotype (Windows). Default false. */
  autotypeEnabled?: boolean;
  /** Suggest entries from foreground window title. Default false. */
  suggestFromForeground?: boolean;
  /** Delay between autotype keystrokes (ms). */
  autotypeKeyDelayMs?: number;
  /** Max dated vault.km copies under data/snapshots. Default 10. */
  snapshotRetain?: number;
  /** Encrypted vault fingerprint (integrity signal). */
  lastVaultSha256?: string | null;
};

export type ForegroundWindowInfo = {
  title: string;
  processName?: string | null;
  platform: string;
  supported: boolean;
};

export type AutotypeMode = "username" | "password" | "login" | "totp";

export type MatchCandidate = {
  entryId: string;
  title: string;
  username: string;
  url: string;
  workspaceId: string;
  workspaceName: string;
  score: number;
};

export type HealthFindingKind =
  | "empty"
  | "short"
  | "weak_charset"
  | "reused"
  | "common"
  | "breached";

export type HealthSeverity = "info" | "warn" | "high";

export type HealthFinding = {
  entryId: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  kind: HealthFindingKind;
  severity: HealthSeverity;
  relatedEntryIds?: string[];
};

export type HealthReport = {
  findings: HealthFinding[];
  scoredEntries: number;
  workspaceScoped: boolean;
};

export type HealthReportOptions = {
  allWorkspaces?: boolean;
  includeTrash?: boolean;
};

export type GeneratorPreset = "strong" | "passphrase" | "pin";

export type GenerateOptions = {
  preset: GeneratorPreset;
  length: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  avoidAmbiguous?: boolean;
};

export type QuickAddDraft = {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  otpSecret: string;
  tags: string[];
  entryType: EntryType;
  hint?: string | null;
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
  notesFormat?: NotesFormat;
  tags: string[];
  customFields: CustomField[];
  otpSecret: string;
};

export type SnapshotInfo = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
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
  listDeletedEntries: () => call<EntrySummary[]>("list_deleted_entries"),
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
        notesFormat: input.notesFormat ?? "plain",
        tags: input.tags,
        customFields: input.customFields,
        otpSecret: input.otpSecret,
      },
    }),
  deleteEntry: (id: string) => call<void>("delete_entry", { id }),
  restoreEntry: (id: string) => call<Entry>("restore_entry", { id }),
  purgeEntry: (id: string) => call<void>("purge_entry", { id }),
  emptyTrash: () => call<number>("empty_trash"),
  trashCount: () => call<number>("trash_count"),
  createVaultSnapshot: () => call<SnapshotInfo>("create_vault_snapshot"),
  listVaultSnapshots: () => call<SnapshotInfo[]>("list_vault_snapshots"),
  restoreVaultSnapshot: (name: string, password: string) =>
    call<StatusDto>("restore_vault_snapshot", { name, password }),
  deleteVaultSnapshot: (name: string) => call<void>("delete_vault_snapshot", { name }),
  addEntryAttachment: (input: {
    entryId: string;
    name: string;
    mime?: string;
    dataBase64: string;
  }) =>
    call<AttachmentMeta>("add_entry_attachment", {
      input: {
        entryId: input.entryId,
        name: input.name,
        mime: input.mime ?? "",
        dataBase64: input.dataBase64,
      },
    }),
  getEntryAttachment: (entryId: string, attachmentId: string) =>
    call<string>("get_entry_attachment", { entryId, attachmentId }),
  removeEntryAttachment: (entryId: string, attachmentId: string) =>
    call<void>("remove_entry_attachment", { entryId, attachmentId }),
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
  generatePassword: (optionsOrLength: GenerateOptions | number = 20) => {
    if (typeof optionsOrLength === "number") {
      return call<string>("generate_password", { length: optionsOrLength, options: null });
    }
    return call<string>("generate_password", { options: optionsOrLength, length: null });
  },
  generatorHistory: () => call<string[]>("generator_history"),
  clearGeneratorHistory: () => call<void>("clear_generator_history"),
  clipboardQuickAdd: (text: string) => call<QuickAddDraft | null>("clipboard_quick_add", { text }),
  passwordHealthReport: (options?: HealthReportOptions) =>
    call<HealthReport>("password_health_report", { options: options ?? null }),
  checkPasswordBreached: (password: string) =>
    call<boolean>("check_password_breached", { password }),
  checkVaultBreaches: (options?: HealthReportOptions) =>
    call<string[]>("check_vault_breaches", { options: options ?? null }),
  getForegroundWindowInfo: () => call<ForegroundWindowInfo>("get_foreground_window_info"),
  autotypeEntry: (
    id: string,
    mode: AutotypeMode,
    options?: { expectedTitle?: string; keyDelayMs?: number },
  ) => call<void>("autotype_entry", { id, mode, options: options ?? null }),
  suggestEntriesForForeground: () =>
    call<MatchCandidate[]>("suggest_entries_for_foreground"),
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
    notesFormat: (e.notesFormat ?? e.notes_format ?? "plain") as NotesFormat,
    tags: e.tags ?? [],
    customFields: e.customFields ?? e.custom_fields ?? [],
    otpSecret: e.otpSecret ?? e.otp_secret ?? "",
    attachments: (e.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      mime: a.mime ?? "application/octet-stream",
      size: a.size,
      createdAt: a.createdAt ?? a.created_at ?? "",
    })),
  };
}
