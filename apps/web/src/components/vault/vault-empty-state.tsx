"use client";

import { ClipboardPaste, FileUp, Plus, RefreshCw } from "lucide-react";
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
  workspaceName,
}: {
  onNewEntry: () => void;
  onNewFromClipboard?: () => void;
  onImported: (result: ImportResult) => void | Promise<void>;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  onReplace?: () => void;
  workspaceName?: string;
}) {
  return (
    <div className="flex h-full min-h-[280px] flex-col gap-4 p-5">
      <div className="text-center">
        <h3 className="font-display text-xl text-[var(--foreground)]">
          {workspaceName ? `${workspaceName} is empty` : "This workspace is empty"}
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add logins manually, paste credentials, or import a file into a dedicated workspace.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4 text-left transition hover:border-[var(--primary)]/50 hover:bg-[var(--accent-wash)]"
          onClick={onNewEntry}
        >
          <Plus className="h-5 w-5 text-[var(--primary)]" />
          <span className="text-sm font-medium">New entry</span>
          <span className="text-xs text-[var(--muted)]">
            Create a login in the current workspace.
          </span>
        </button>
        {onNewFromClipboard && (
          <button
            type="button"
            className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4 text-left transition hover:border-[var(--primary)]/50 hover:bg-[var(--accent-wash)]"
            onClick={onNewFromClipboard}
          >
            <ClipboardPaste className="h-5 w-5 text-[var(--primary)]" />
            <span className="text-sm font-medium">From clipboard</span>
            <span className="text-xs text-[var(--muted)]">
              Draft from otpauth, password, or labeled paste — no auto-save.
            </span>
          </button>
        )}
        <button
          type="button"
          className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4 text-left transition hover:border-[var(--primary)]/50 hover:bg-[var(--accent-wash)]"
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
          <ClipboardPaste className="h-5 w-5 text-[var(--primary)]" />
          <span className="text-sm font-medium">Paste → new workspace</span>
          <span className="text-xs text-[var(--muted)]">
            Creates a workspace from clipboard Email / Password blocks.
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4 text-left transition hover:border-[var(--primary)]/50 hover:bg-[var(--accent-wash)]"
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
          <FileUp className="h-5 w-5 text-[var(--primary)]" />
          <span className="text-sm font-medium">Import → new workspace</span>
          <span className="text-xs text-[var(--muted)]">
            File name becomes the workspace name.
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4 text-left transition hover:border-[var(--primary)]/50 hover:bg-[var(--accent-wash)]"
          onClick={() => onReplace?.()}
        >
          <RefreshCw className="h-5 w-5 text-[var(--primary)]" />
          <span className="text-sm font-medium">Replace this list</span>
          <span className="text-xs text-[var(--muted)]">
            Re-import a file and overwrite the current workspace entries.
          </span>
        </button>
      </div>

      <FileDropZone className="flex-1" mode="new" onImported={onImported} onError={onError} />

      <p className="text-center text-xs text-[var(--muted)]">
        Encrypted vault backups (.km) are under{" "}
        <button
          type="button"
          className="text-[var(--primary)] underline-offset-2 hover:underline"
          onClick={onOpenSettings}
        >
          Settings → Import / export
        </button>
        .
      </p>
    </div>
  );
}
