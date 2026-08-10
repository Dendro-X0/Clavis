"use client";

import { useEffect, useState } from "react";
import { api, type AttachmentMeta, type EntryType, type UpsertEntryInput } from "@/lib/api";
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
  attachments = [],
  onChange,
  onAttachmentsChange,
  onClose,
  onSave,
  onDelete,
  onGenerate,
  onCopy,
  onError,
}: {
  form: UpsertEntryInput;
  attachments?: AttachmentMeta[];
  onChange: (updater: (prev: UpsertEntryInput) => UpsertEntryInput) => void;
  onAttachmentsChange?: (list: AttachmentMeta[]) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onGenerate: () => Promise<void>;
  /** Optional hook after a successful field copy (e.g. schedule clipboard clear). */
  onCopy?: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const [showMdPreview, setShowMdPreview] = useState(false);
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
            className="btn-ghost-sm"
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
          label="Username / email"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v }))}
          onCopy={onCopy}
          onError={onError}
        />
        <p className="-mt-2 text-xs text-[var(--muted)]">
          Primary login id — use email or username here. Add extra emails or a phone below.
        </p>
        <label className="block text-sm">
          Password / secret
          <div className="mt-1 flex gap-2">
            <HoldToRevealPassword
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            />
            <CopyIconButton
              value={form.password}
              label="password"
              onCopied={() => onCopy?.()}
              onError={onError}
            />
            <button
              type="button"
              className="btn-ghost shrink-0"
              onClick={() => onGenerate().catch((e) => onError(String(e)))}
            >
              Generate…
            </button>
          </div>
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Hold Reveal to show the secret.
          </span>
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Select
              value={form.notesFormat ?? "plain"}
              onValueChange={(value) =>
                setForm((f) => ({
                  ...f,
                  notesFormat: value as "plain" | "markdown",
                }))
              }
            >
              <SelectTrigger className="w-[9.5rem]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain text</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
            {(form.notesFormat ?? "plain") === "markdown" && (
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setShowMdPreview((v) => !v)}
              >
                {showMdPreview ? "Edit" : "Preview"}
              </button>
            )}
          </div>
          {(form.notesFormat ?? "plain") === "markdown" && showMdPreview ? (
            <div
              className="inset-field mt-1 min-h-24 w-full overflow-auto px-3 py-2 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: simpleMarkdownHtml(form.notes) }}
            />
          ) : (
            <textarea
              className="inset-field mt-1 min-h-24 w-full px-3 py-2 font-mono text-sm"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          )}
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

        <AttachmentsSection
          entryId={form.id}
          attachments={attachments}
          onChange={onAttachmentsChange}
          onError={onError}
        />

        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <h3 className="text-sm font-medium">Authenticator (TOTP)</h3>
          <p className="text-xs text-[var(--muted)]">
            Paste an otpauth:// URI or Base32 seed. Codes use SHA-1 · 6 digits · 30s (offline).
          </p>
          <label className="block text-sm">
            TOTP secret
            <div className="mt-1 flex gap-2">
              <HoldToRevealPassword
                value={form.otpSecret ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, otpSecret: v }))}
              />
              <CopyIconButton
                value={form.otpSecret ?? ""}
                label="totp secret"
                onCopied={() => onCopy?.()}
                onError={onError}
              />
            </div>
          </label>
          {form.id && (form.otpSecret ?? "").trim() && (
            <TotpLivePreview entryId={form.id} onError={onError} onCopy={onCopy} />
          )}
        </div>

        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Custom fields</h3>
            <div className="flex flex-wrap gap-1.5">
              {(["Email", "Phone"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      customFields: [...(f.customFields ?? []), { label: preset, value: "" }],
                    }))
                  }
                >
                  + {preset}
                </button>
              ))}
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    customFields: [...(f.customFields ?? []), { label: "", value: "" }],
                  }))
                }
              >
                + Field
              </button>
            </div>
          </div>
          {(form.customFields ?? []).length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Optional extras (second email, mobile, recovery codes, …).
            </p>
          ) : (
            <ul className="space-y-2">
              {(form.customFields ?? []).map((field, index) => (
                <li key={index} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                  <label className="block min-w-[7rem] flex-1 text-sm">
                    Label
                    <input
                      className="inset-field mt-1 w-full px-3 py-2"
                      value={field.label}
                      placeholder="e.g. Phone"
                      onChange={(e) => {
                        const label = e.target.value;
                        setForm((f) => {
                          const next = [...(f.customFields ?? [])];
                          next[index] = { ...next[index], label };
                          return { ...f, customFields: next };
                        });
                      }}
                    />
                  </label>
                  <label className="block min-w-0 flex-[2] text-sm">
                    Value
                    <div className="mt-1 flex gap-2">
                      <input
                        className="inset-field w-full px-3 py-2"
                        value={field.value}
                        placeholder="Value"
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((f) => {
                            const next = [...(f.customFields ?? [])];
                            next[index] = { ...next[index], value };
                            return { ...f, customFields: next };
                          });
                        }}
                      />
                      <CopyIconButton
                        value={field.value}
                        label={field.label.trim() || "custom field"}
                        onCopied={() => onCopy?.()}
                        onError={onError}
                      />
                      <button
                        type="button"
                        className="btn-ghost-sm shrink-0 hover:border-[var(--danger)]/50 hover:text-[var(--danger)]"
                        title="Remove field"
                        aria-label="Remove field"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            customFields: (f.customFields ?? []).filter((_, i) => i !== index),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3 shrink-0">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            onSave().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
          }
        >
          Save
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            className="btn-danger ml-auto"
            onClick={() =>
              onDelete().catch((e) => onError(String(e).replace(/^Error:\s*/, "")))
            }
          >
            Move to bin
          </button>
        )}
      </div>
    </section>
  );
}

function AttachmentsSection({
  entryId,
  attachments,
  onChange,
  onError,
}: {
  entryId?: string;
  attachments: AttachmentMeta[];
  onChange?: (list: AttachmentMeta[]) => void;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onPick(fileList: FileList | null) {
    if (!entryId) {
      onError("Save the entry before adding attachments.");
      return;
    }
    const file = fileList?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      onError("Attachment too large (max 256 KiB).");
      return;
    }
    if (attachments.length >= 5) {
      onError("Max 5 attachments per entry.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const dataBase64 = btoa(binary);
      const meta = await api.addEntryAttachment({
        entryId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        dataBase64,
      });
      onChange?.([
        ...attachments,
        {
          id: meta.id,
          name: meta.name,
          mime: meta.mime ?? "application/octet-stream",
          size: meta.size,
          createdAt: meta.createdAt ?? meta.created_at ?? "",
        },
      ]);
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  async function download(att: AttachmentMeta) {
    if (!entryId) return;
    try {
      const b64 = await api.getEntryAttachment(entryId, att.id);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: att.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.name || "attachment";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function remove(att: AttachmentMeta) {
    if (!entryId) return;
    try {
      await api.removeEntryAttachment(entryId, att.id);
      onChange?.(attachments.filter((a) => a.id !== att.id));
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Attachments</h3>
        <label
          className={`btn-ghost-sm cursor-pointer ${
            busy || !entryId ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Uploading…" : "+ File"}
          <input
            type="file"
            className="hidden"
            disabled={busy || !entryId}
            onChange={(e) => {
              void onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Encrypted sidecars (max 256 KiB, 5 per entry). Not included in encrypted vault export — use
        snapshots or keep the data folder intact. Save the entry first to attach.
      </p>
      {attachments.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No attachments.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">
                {att.name}{" "}
                <span className="text-xs text-[var(--muted)]">
                  ({Math.max(1, Math.round(att.size / 1024))} KiB)
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => void download(att)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="btn-danger-sm"
                  onClick={() => void remove(att)}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Minimal escaped markdown → HTML (headings, bold, italic, code, breaks). */
function simpleMarkdownHtml(src: string): string {
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = esc.split(/\r?\n/).map((line) => {
    if (/^###\s+/.test(line)) return `<h3 class="font-medium mt-2">${line.replace(/^###\s+/, "")}</h3>`;
    if (/^##\s+/.test(line)) return `<h2 class="font-medium text-base mt-2">${line.replace(/^##\s+/, "")}</h2>`;
    if (/^#\s+/.test(line)) return `<h1 class="font-display text-lg mt-2">${line.replace(/^#\s+/, "")}</h1>`;
    let t = line
      .replace(/`([^`]+)`/g, '<code class="rounded bg-[var(--inset)] px-1 font-mono text-xs">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return t ? `<p class="my-1">${t}</p>` : "<br/>";
  });
  return lines.join("") || "<p class=\"text-[var(--muted)]\">(empty)</p>";
}

function TotpLivePreview({
  entryId,
  onError,
  onCopy,
}: {
  entryId: string;
  onError: (e: string) => void;
  onCopy?: () => void | Promise<void>;
}) {
  const [code, setCode] = useState<string>("······");
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const dto = await api.entryTotpCode(entryId);
        if (cancelled) return;
        setCode(dto.code);
        setSecs(dto.secondsRemaining);
      } catch {
        if (!cancelled) setCode("—");
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [entryId]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono text-lg tracking-widest">{code}</span>
      <span className="text-xs text-[var(--muted)]">{secs}s</span>
      <CopyIconButton
        value={code === "—" || code === "······" ? "" : code}
        label="totp code"
        onCopied={() => onCopy?.()}
        onError={onError}
      />
    </div>
  );
}

function HoldToRevealPassword({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <input
        type={revealed ? "text" : "password"}
        autoComplete="off"
        className="inset-field w-full px-3 py-2 font-mono text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn-ghost shrink-0"
        title="Hold to reveal"
        onMouseDown={() => setRevealed(true)}
        onMouseUp={() => setRevealed(false)}
        onMouseLeave={() => setRevealed(false)}
        onTouchStart={(e) => {
          e.preventDefault();
          setRevealed(true);
        }}
        onTouchEnd={() => setRevealed(false)}
        onTouchCancel={() => setRevealed(false)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setRevealed(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setRevealed(false);
          }
        }}
        onBlur={() => setRevealed(false)}
      >
        Reveal
      </button>
    </div>
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
