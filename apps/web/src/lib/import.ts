import { api, type ImportMode, type ImportResult, type WorkspaceSummary } from "@/lib/api";
import { appConfirm } from "@/lib/app-dialogs";

export function workspaceNameFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "Imported";
  const stem = base.replace(/\.[^.]+$/, "").trim();
  return stem || "Imported";
}

export type ResolvedImport = {
  mode: ImportMode;
  workspaceId?: string;
};

/**
 * When importing as "new", if a workspace with the same name exists, ask to replace it.
 * Returns null if the user cancels.
 */
export async function resolveImportCollision(
  proposedName: string,
  requested: ImportMode = "new",
  workspaces?: WorkspaceSummary[],
): Promise<ResolvedImport | null> {
  if (requested === "replace") {
    return { mode: "replace" };
  }

  const list = workspaces ?? (await api.listWorkspaces());
  const existing = list.find(
    (w) => w.name.trim().toLowerCase() === proposedName.trim().toLowerCase(),
  );
  if (!existing) {
    return { mode: "new" };
  }

  const ok = await appConfirm({
    title: "Replace existing workspace?",
    description: `A workspace named “${existing.name}” already exists (${existing.entryCount} entries).\n\nReplace it with this import?`,
    confirmLabel: "Replace",
    danger: true,
  });
  if (!ok) return null;
  return { mode: "replace", workspaceId: existing.id };
}

export async function importCredentialsFileSmart(
  path: string,
  mode: ImportMode = "new",
): Promise<ImportResult | null> {
  const name = workspaceNameFromPath(path);
  const resolved = await resolveImportCollision(name, mode);
  if (!resolved) return null;
  return api.importCredentialsFile(path, resolved.mode, resolved.workspaceId);
}

export async function importCredentialsTextSmart(
  text: string,
  mode: ImportMode = "new",
  workspaceName = "Pasted import",
): Promise<ImportResult | null> {
  const resolved = await resolveImportCollision(workspaceName, mode);
  if (!resolved) return null;
  return api.importCredentialsText(text, resolved.mode, workspaceName, resolved.workspaceId);
}
