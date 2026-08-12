"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FileUp } from "lucide-react";
import { api, type ImportMode, type ImportResult } from "@/lib/api";
import { importCredentialsFileSmart, importCredentialsTextSmart } from "@/lib/import";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";

const TEXT_EXTS = new Set(["txt", "md", "csv", "tsv"]);
const SHEET_EXTS = new Set(["xlsx", "xls", "ods"]);

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function importDroppedPaths(
  paths: string[],
  mode: ImportMode = "new",
): Promise<ImportResult | null> {
  let last: ImportResult | null = null;
  let currentMode = mode;
  for (const path of paths) {
    const ext = extOf(path);
    if (ext === "km") {
      throw new Error("Encrypted .km backups must be imported from Settings with the vault password.");
    }
    if (TEXT_EXTS.has(ext) || SHEET_EXTS.has(ext) || ext === "") {
      const result = await importCredentialsFileSmart(path, currentMode);
      if (!result) {
        return last;
      }
      last = result;
      currentMode = "new";
    } else {
      throw new Error(`Unsupported file type: .${ext || "?"}`);
    }
  }
  if (!last) throw new Error("No supported files dropped.");
  return last;
}

export async function importBrowserFiles(
  files: FileList | File[],
  mode: ImportMode = "new",
): Promise<ImportResult | null> {
  const list = Array.from(files);
  let last: ImportResult | null = null;
  let currentMode = mode;
  for (const file of list) {
    const ext = extOf(file.name);
    if (SHEET_EXTS.has(ext)) {
      throw new Error(
        "Excel/ODS drops need the desktop file path. Use Browse or drop onto the Clavis window.",
      );
    }
    if (ext === "km") {
      throw new Error("Encrypted .km backups must be imported from Settings with the vault password.");
    }
    const text = await file.text();
    const stem = file.name.replace(/\.[^.]+$/, "") || "Pasted import";
    const result = await importCredentialsTextSmart(text, currentMode, stem);
    if (!result) return last;
    last = result;
    currentMode = "new";
  }
  if (!last) throw new Error("No supported files dropped.");
  return last;
}

// ---------------------------------------------------------------------------
// Singleton Tauri native drop handler.
// onDragDropEvent is window-global — if every FileDropZone registered its own
// listener, a single file drop would trigger N imports (one per mounted zone).
// Instead we register once and let the *most recently focused* zone handle it.
// ---------------------------------------------------------------------------

type DropSubscriber = {
  onPaths: (paths: string[]) => Promise<void>;
  onActive: (active: boolean) => void;
};

let globalSubscriber: DropSubscriber | null = null;
let globalUnlisten: (() => void) | null = null;
let globalInitStarted = false;

function setGlobalSubscriber(sub: DropSubscriber | null) {
  globalSubscriber = sub;
}

async function ensureGlobalTauriDrop() {
  if (globalInitStarted) return;
  globalInitStarted = true;
  if (!(await isTauri())) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    globalUnlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
      if (!globalSubscriber) return;
      if (event.payload.type === "enter" || event.payload.type === "over") {
        globalSubscriber.onActive(true);
      } else if (event.payload.type === "leave") {
        globalSubscriber.onActive(false);
      } else if (event.payload.type === "drop") {
        globalSubscriber.onActive(false);
        await globalSubscriber.onPaths(event.payload.paths);
      }
    });
  } catch {
    /* ignore — browser-only build */
  }
}

export function FileDropZone({
  className,
  children,
  onImported,
  onError,
  compact,
  mode = "new",
}: {
  className?: string;
  children?: ReactNode;
  onImported: (result: ImportResult) => void | Promise<void>;
  onError: (message: string) => void;
  compact?: boolean;
  mode?: ImportMode;
}) {
  const [active, setActive] = useState(false);
  const isTauriEnv = useRef(false);

  const handlePaths = useCallback(
    async (paths: string[]) => {
      try {
        const result = await importDroppedPaths(paths, mode);
        if (result) await onImported(result);
      } catch (e) {
        onError(String(e).replace(/^Error:\s*/, ""));
      }
    },
    [onImported, onError, mode],
  );

  useEffect(() => {
    const sub: DropSubscriber = {
      onPaths: handlePaths,
      onActive: setActive,
    };

    (async () => {
      await ensureGlobalTauriDrop();
      if (await isTauri()) {
        isTauriEnv.current = true;
        setGlobalSubscriber(sub);
      }
    })();

    return () => {
      // Only clear if we're still the active subscriber.
      if (globalSubscriber === sub) {
        setGlobalSubscriber(null);
      }
    };
  }, [handlePaths]);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed transition",
        active
          ? "border-[var(--primary)] bg-[var(--accent-wash)]"
          : "border-[var(--border)] bg-[var(--card)]/40",
        className,
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setActive(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setActive(false);
        if (isTauriEnv.current) return;
        if (!e.dataTransfer.files?.length) return;
        try {
          const result = await importBrowserFiles(e.dataTransfer.files, mode);
          if (result) await onImported(result);
        } catch (err) {
          onError(String(err).replace(/^Error:\s*/, ""));
        }
      }}
    >
      {children ?? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 text-center text-[var(--muted)]",
            compact ? "px-4 py-6" : "px-6 py-10",
          )}
        >
          <FileUp className="h-8 w-8 text-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--foreground)]">
            {mode === "replace"
              ? "Drop a file to replace this workspace"
              : "Drop credential files here"}
          </p>
          <p className="max-w-sm text-xs">
            {mode === "replace"
              ? "Re-import replaces the current workspace list. Dropping creates a new workspace by default elsewhere."
              : "Each import creates its own workspace. If the name already exists, you can choose to replace it."}
          </p>
        </div>
      )}
    </div>
  );
}
