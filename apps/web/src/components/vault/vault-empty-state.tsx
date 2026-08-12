"use client";

import { ClipboardPaste, FileUp, Plus } from "lucide-react";
import { FileDropZone } from "@/components/import/file-drop-zone";
import { api, type ImportResult } from "@/lib/api";
import { importCredentialsFileSmart, importCredentialsTextSmart } from "@/lib/import";

export function VaultEmptyState({
  onNewEntry,
  onNewFromClipboard,
  onImported,
  onError,
  onOpenSettings,
  onReplace,
  noWorkspaces,
  workspaceName,
}: {
  onNewEntry: () => void;
  onNewFromClipboard?: () => void;
  onImported: (result: ImportResult) => void | Promise<void>;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  onReplace?: () => void;
  noWorkspaces?: boolean;
  workspaceName?: string;
}) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-md text-center">
        <h3 className="settings-section-title text-[var(--foreground)]">
          {noWorkspaces
            ? "No workspaces yet"
            : workspaceName
              ? `${workspaceName} is empty`
              : "This workspace is empty"}
        </h3>
        <p className="settings-section-desc mt-2">
          {noWorkspaces
            ? "Import a credentials file to create your first workspace, or create one manually."
            : "Create a login, or bring credentials in from a file or the clipboard."}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <button type="button" className="btn-primary flex w-full items-center justify-center gap-2 py-2.5" onClick={onNewEntry}>
          <Plus className="h-4 w-4" aria-hidden />
          New entry
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-ghost flex items-center justify-center gap-2"
            onClick={async () => {
              try {
                const path = await api.pickOpenPath("credentials");
                if (!path) return;
                const result = await importCredentialsFileSmart(path, "new");
                if (result) await onImported(result);
              } catch (e) {
                onError(String(e).replace(/^Error:\s*/, ""));
              }
            }}
          >
            <FileUp className="h-4 w-4" aria-hidden />
            Import file
          </button>
          {onNewFromClipboard ? (
            <button
              type="button"
              className="btn-ghost flex items-center justify-center gap-2"
              onClick={onNewFromClipboard}
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              From clipboard
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost flex items-center justify-center gap-2"
              onClick={async () => {
                try {
                  let text = "";
                  try {
                    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
                    text = await readText();
                  } catch {
                    text = await navigator.clipboard.readText();
                  }
                  if (!text.trim()) {
                    onError("Clipboard is empty. Copy a credentials note first.");
                    return;
                  }
                  const result = await importCredentialsTextSmart(text, "new", "Pasted import");
                  if (result) await onImported(result);
                } catch (e) {
                  onError(String(e).replace(/^Error:\s*/, ""));
                }
              }}
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              Paste import
            </button>
          )}
        </div>
      </div>

      <FileDropZone
        className="w-full max-w-md"
        compact
        mode="new"
        onImported={onImported}
        onError={onError}
      />

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <button
          type="button"
          className="underline-offset-2 hover:text-[var(--foreground)] hover:underline"
          onClick={async () => {
            try {
              let text = "";
              try {
                const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
                text = await readText();
              } catch {
                text = await navigator.clipboard.readText();
              }
              if (!text.trim()) {
                onError("Clipboard is empty. Copy a credentials note first.");
                return;
              }
              const result = await importCredentialsTextSmart(text, "new", "Pasted import");
              if (result) await onImported(result);
            } catch (e) {
              onError(String(e).replace(/^Error:\s*/, ""));
            }
          }}
        >
          Paste → new workspace
        </button>
        {onReplace && !noWorkspaces && (
          <button
            type="button"
            className="text-[var(--danger)] underline-offset-2 hover:underline"
            onClick={() => onReplace()}
          >
            Replace this list…
          </button>
        )}
        <button
          type="button"
          className="underline-offset-2 hover:text-[var(--foreground)] hover:underline"
          onClick={onOpenSettings}
        >
          Encrypted backup…
        </button>
      </div>
    </div>
  );
}
