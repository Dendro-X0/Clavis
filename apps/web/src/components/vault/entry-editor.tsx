"use client";

import type { EntryType, UpsertEntryInput } from "@/lib/api";
import { CopyIconButton } from "@/components/ui/copy-button";
import {
  hasParsedCredentialFields,
  parseLabeledCredentialFields,
  readClipboardText,
} from "@/lib/clipboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EntryEditor({
  form,
  onChange,
  onClose,
  onSave,
  onDelete,
  onGenerate,
  onCopy,
  onError,
}: {
  form: UpsertEntryInput;
  onChange: (updater: (prev: UpsertEntryInput) => UpsertEntryInput) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onGenerate: () => Promise<void>;
  /** Optional hook after a successful field copy (e.g. schedule clipboard clear). */
  onCopy?: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const setForm = (patch: Partial<UpsertEntryInput> | ((f: UpsertEntryInput) => UpsertEntryInput)) => {
    onChange((f) => (typeof patch === "function" ? patch(f) : { ...f, ...patch }));
  };

  async function pasteAlignedFields() {
    try {
      const text = await readClipboardText();
      if (!text.trim()) {
        onError("Clipboard is empty.");
        return;
      }
      const parsed = parseLabeledCredentialFields(text);
      if (!hasParsedCredentialFields(parsed)) {
        onError("No labeled fields found (Name, Username, Password, URL, …).");
        return;
      }
      // Only overwrite fields that are present in the paste — missing labels stay as-is.
      setForm((f) => ({
        ...f,
        ...(parsed.title != null ? { title: parsed.title } : {}),
        ...(parsed.username != null ? { username: parsed.username } : {}),
        ...(parsed.password != null ? { password: parsed.password } : {}),
        ...(parsed.url != null ? { url: parsed.url } : {}),
        ...(parsed.notes != null ? { notes: parsed.notes } : {}),
        ...(parsed.tags != null ? { tags: parsed.tags } : {}),
      }));
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  return (
    <section className="animate-rise flex h-full min-h-0 flex-col overflow-hidden panel">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-display text-xl">{form.id ? "Edit entry" : "New entry"}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:bg-[var(--inset)] hover:text-[var(--foreground)]"
            title="Paste labeled credentials into matching fields (skips missing labels)"
            onClick={() => pasteAlignedFields().catch((e) => onError(String(e)))}
          >
            Paste fields
          </button>
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-region p-4">
        <label className="block text-sm">
          Type
          <Select
            value={form.entryType}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, entryType: value as EntryType }))
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="note">Secure note</SelectItem>
              <SelectItem value="api">API / token</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <CopyableField
          label="Name"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          onCopy={onCopy}
          onError={onError}
        />
        <CopyableField
          label="Username"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v }))}
          onCopy={onCopy}
          onError={onError}
        />
        <label className="block text-sm">
          Password / secret
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              className="inset-field w-full px-3 py-2 font-mono text-sm"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <CopyIconButton
              value={form.password}
              label="password"
              onCopied={() => onCopy?.()}
              onError={onError}
            />
            <button
              type="button"
              className="shrink-0 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--accent-wash)]"
              onClick={() => onGenerate().catch((e) => onError(String(e)))}
            >
              Generate
            </button>
          </div>
        </label>
        <CopyableField
          label="URL"
          value={form.url}
          onChange={(v) => setForm((f) => ({ ...f, url: v }))}
          onCopy={onCopy}
          onError={onError}
        />
        <label className="block text-sm">
          Notes
          <textarea
            className="inset-field mt-1 min-h-24 w-full px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <CopyableField
          label="Categories"
          value={form.tags.join(", ")}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              tags: v
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }))
          }
          copyValue={form.tags.join(", ")}
          onCopy={onCopy}
          onError={onError}
        />
        <p className="text-xs text-[var(--muted)]">
          Comma-separated labels (e.g. work, banking). Filter them from the dashboard.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3 shrink-0">
        <button
          className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-fg)]"
          onClick={() =>
            onSave().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
          }
        >
          Save
        </button>
        <button
          className="rounded-md border border-[var(--border)] px-4 py-2"
          onClick={onClose}
        >
          Cancel
        </button>
        {onDelete && (
          <button
            className="ml-auto rounded-md border border-[var(--danger)]/50 px-4 py-2 text-[var(--danger)]"
            onClick={() =>
              onDelete().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
            }
          >
            Delete
          </button>
        )}
      </div>
    </section>
  );
}

function CopyableField({
  label,
  value,
  onChange,
  copyValue,
  onCopy,
  onError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  copyValue?: string;
  onCopy?: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const text = copyValue ?? value;
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          className="inset-field w-full px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <CopyIconButton
          value={text}
          label={label.toLowerCase()}
          onCopied={() => onCopy?.()}
          onError={onError}
        />
      </div>
    </label>
  );
}
