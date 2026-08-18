"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, Pencil } from "lucide-react";
import type { AttachmentMeta, EntryType, UpsertEntryInput } from "@/lib/api";
import { api } from "@/lib/api";
import { CopyIconButton } from "@/components/ui/copy-button";
import { EntryIcon } from "@/components/vault/entry-icon";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<EntryType, string> = {
  login: "Login",
  note: "Secure note",
  api: "API / token",
  custom: "Custom",
};

export function EntryPreview({
  form,
  attachments = [],
  fetchFavicons = false,
  expanded = false,
  onExpandedChange,
  onModeChange,
  onEdit,
  onClose,
  onDelete,
  onCopy,
  onCopyLogin,
  onCopyAll,
  onCopyUser,
  onCopyPass,
  onCopyOtp,
  onError,
}: {
  form: UpsertEntryInput;
  attachments?: AttachmentMeta[];
  fetchFavicons?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onModeChange?: (mode: "view" | "edit") => void;
  onEdit: () => void;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onCopy?: () => void | Promise<void>;
  onCopyLogin?: () => void;
  onCopyAll?: () => void;
  onCopyUser?: () => void;
  onCopyPass?: () => void;
  onCopyOtp?: () => void;
  onError: (e: string) => void;
}) {
  const hasOtp = Boolean((form.otpSecret ?? "").trim());
  const tags = form.tags ?? [];
  const customFields = (form.customFields ?? []).filter(
    (f) => f.label.trim() || f.value.trim(),
  );

  return (
    <section
      className={cn(
        "animate-rise entry-preview flex h-full min-h-0 flex-col overflow-hidden",
        expanded ? "bg-transparent" : "panel",
      )}
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <EntryIcon
              title={form.title}
              url={form.url}
              fetchEnabled={fetchFavicons}
              className="h-10 w-10 text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate font-display text-lg leading-tight">
                  {form.title.trim() || "Untitled"}
                </p>
                <ModeToggle
                  mode="view"
                  onChange={(next) => (next === "edit" ? onEdit() : onModeChange?.("view"))}
                />
              </div>
              <span className="mt-1 inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--muted)] uppercase">
                {TYPE_LABELS[form.entryType]}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onExpandedChange && (
              <ExpandToggle expanded={expanded} onChange={onExpandedChange} />
            )}
            <button
              type="button"
              className="shrink-0 px-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {form.id && (
          <div className="flex flex-wrap gap-1.5">
            {onCopyLogin && (
              <QuickCopyButton label="Copy login" onClick={onCopyLogin} primary />
            )}
            {onCopyAll && (
              <QuickCopyButton label="Copy all" onClick={onCopyAll} />
            )}
            {onCopyUser && form.username.trim() && (
              <QuickCopyButton label="User" onClick={onCopyUser} />
            )}
            {onCopyPass && form.password && (
              <QuickCopyButton label="Pass" onClick={onCopyPass} />
            )}
            {onCopyOtp && hasOtp && (
              <QuickCopyButton label="TOTP" onClick={onCopyOtp} />
            )}
          </div>
        )}
      </header>

      <div
        className={cn(
          "entry-preview__body min-h-0 flex-1 overflow-y-auto scroll-region p-4",
          expanded
            ? "grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start"
            : "space-y-3",
        )}
      >
        <div className="space-y-3">
          {(form.entryType === "login" ||
            form.username.trim() ||
            form.password ||
            form.url.trim()) && (
            <PreviewSection title="Credentials">
              {(form.entryType === "login" || form.username.trim()) && (
                <PreviewRow
                  label="Username / email"
                  value={form.username}
                  emptyLabel="No username"
                  copyLabel="username"
                  onCopy={onCopy}
                  onError={onError}
                />
              )}
              {(form.entryType === "login" ||
                form.entryType === "api" ||
                form.password) && (
                <PreviewSecretRow
                  label={form.entryType === "api" ? "Token / secret" : "Password"}
                  value={form.password}
                  copyLabel="password"
                  onCopy={onCopy}
                  onError={onError}
                />
              )}
              {form.url.trim() && (
                <PreviewRow
                  label="URL"
                  value={form.url}
                  copyLabel="url"
                  onCopy={onCopy}
                  onError={onError}
                  href={form.url}
                />
              )}
            </PreviewSection>
          )}

          {customFields.length > 0 && (
            <PreviewSection title="Custom fields">
              {customFields.map((field, index) => (
                <PreviewRow
                  key={`${field.label}-${index}`}
                  label={field.label.trim() || `Field ${index + 1}`}
                  value={field.value}
                  copyLabel={field.label.trim() || "custom field"}
                  onCopy={onCopy}
                  onError={onError}
                />
              ))}
            </PreviewSection>
          )}

          {hasOtp && form.id && (
            <PreviewSection title="Authenticator">
              <div className="px-3 py-3">
                <TotpLivePreview
                  entryId={form.id}
                  onError={onError}
                  onCopy={onCopy}
                />
              </div>
            </PreviewSection>
          )}

          {tags.length > 0 && (
            <PreviewSection title="Categories">
              <div className="flex flex-wrap gap-1.5 px-3 py-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[var(--accent-wash)] px-2 py-1 text-xs text-[var(--foreground)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </PreviewSection>
          )}
        </div>

        <div className="space-y-3">
          {form.notes.trim() && (
            <PreviewSection title="Notes">
              <div className="px-3 py-3">
                {(form.notesFormat ?? "plain") === "markdown" ? (
                  <div
                    className={cn(
                      "entry-preview__notes prose-sm text-sm leading-relaxed text-[var(--foreground)]",
                      expanded && "entry-preview__notes--expanded",
                    )}
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdownHtml(form.notes),
                    }}
                  />
                ) : (
                  <pre
                    className={cn(
                      "entry-preview__notes whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--foreground)]",
                      expanded && "entry-preview__notes--expanded",
                    )}
                  >
                    {form.notes}
                  </pre>
                )}
                <div className="mt-2 flex justify-end">
                  <CopyIconButton
                    value={form.notes}
                    label="notes"
                    onCopied={() => onCopy?.()}
                    onError={onError}
                  />
                </div>
              </div>
            </PreviewSection>
          )}

          {attachments.length > 0 && (
            <PreviewSection title="Attachments">
              <AttachmentPreviewList
                entryId={form.id}
                attachments={attachments}
                onError={onError}
              />
            </PreviewSection>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
        <button type="button" className="btn-primary" onClick={onEdit}>
          <Pencil className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Edit
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
      </footer>
    </section>
  );
}

export function ExpandToggle({
  expanded,
  onChange,
}: {
  expanded: boolean;
  onChange: (expanded: boolean) => void;
}) {
  const Icon = expanded ? Minimize2 : Maximize2;
  const label = expanded ? "Dock to sidebar" : "Open large window";
  return (
    <button
      type="button"
      className="btn-icon"
      title={label}
      aria-label={label}
      aria-pressed={expanded}
      onClick={() => onChange(!expanded)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: "view" | "edit";
  onChange: (mode: "view" | "edit") => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-[var(--border)] p-0.5 text-xs"
      role="tablist"
      aria-label="Entry panel mode"
    >
      {(["view", "edit"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          className={cn(
            "rounded px-2 py-1 capitalize transition",
            mode === value
              ? "bg-[var(--accent-wash)] text-[var(--foreground)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
          onClick={() => onChange(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/50">
      <h3 className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
        {title}
      </h3>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

function PreviewRow({
  label,
  value,
  emptyLabel = "—",
  copyLabel,
  href,
  onCopy,
  onError,
}: {
  label: string;
  value: string;
  emptyLabel?: string;
  copyLabel: string;
  href?: string;
  onCopy?: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const trimmed = value.trim();
  const display = trimmed || emptyLabel;
  const isEmpty = !trimmed;

  return (
    <div className="flex items-start gap-2 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-wide text-[var(--muted)] uppercase">
          {label}
        </p>
        {href && !isEmpty ? (
          <a
            href={normalizeHref(href)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-[var(--primary)] underline-offset-2 hover:underline"
          >
            <span className="truncate">{display}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </a>
        ) : (
          <p
            className={cn(
              "mt-1 break-all text-sm",
              isEmpty ? "text-[var(--muted)] italic" : "text-[var(--foreground)]",
            )}
          >
            {display}
          </p>
        )}
      </div>
      {!isEmpty && (
        <CopyIconButton
          value={value}
          label={copyLabel}
          onCopied={() => onCopy?.()}
          onError={onError}
          className="mt-4"
        />
      )}
    </div>
  );
}

function PreviewSecretRow({
  label,
  value,
  copyLabel,
  onCopy,
  onError,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy?: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const hasValue = Boolean(value);

  return (
    <div className="flex items-start gap-2 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-wide text-[var(--muted)] uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 break-all font-mono text-sm tracking-wide",
            hasValue ? "text-[var(--foreground)]" : "text-[var(--muted)] italic",
          )}
          aria-live="polite"
        >
          {!hasValue
            ? "No secret"
            : revealed
              ? value
              : "•".repeat(Math.min(Math.max(value.length, 8), 24))}
        </p>
        {hasValue && (
          <button
            type="button"
            className="btn-ghost-sm mt-2"
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
            Hold to reveal
          </button>
        )}
      </div>
      {hasValue && (
        <CopyIconButton
          value={value}
          label={copyLabel}
          onCopied={() => onCopy?.()}
          onError={onError}
          className="mt-4"
        />
      )}
    </div>
  );
}

function QuickCopyButton({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "btn-ghost-sm min-h-8 px-2.5 text-xs",
        primary &&
          "border-transparent bg-[var(--primary)]/12 font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/22",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AttachmentPreviewList({
  entryId,
  attachments,
  onError,
}: {
  entryId?: string;
  attachments: AttachmentMeta[];
  onError: (e: string) => void;
}) {
  async function download(att: AttachmentMeta) {
    if (!entryId) return;
    try {
      const b64 = await api.getEntryAttachment(entryId, att.id);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: att.mime || "application/octet-stream",
      });
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

  return (
    <ul className="divide-y divide-[var(--border)]">
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
        >
          <span className="min-w-0 truncate">
            {att.name}{" "}
            <span className="text-xs text-[var(--muted)]">
              ({Math.max(1, Math.round(att.size / 1024))} KiB)
            </span>
          </span>
          <button
            type="button"
            className="btn-ghost-sm shrink-0"
            onClick={() => void download(att)}
          >
            Download
          </button>
        </li>
      ))}
    </ul>
  );
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
    <div className="flex items-center gap-3">
      <span className="font-mono text-2xl tracking-[0.2em] text-[var(--foreground)]">
        {code}
      </span>
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

function normalizeHref(url: string): string {
  const raw = url.trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function simpleMarkdownHtml(src: string): string {
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = esc.split(/\r?\n/).map((line) => {
    if (/^###\s+/.test(line))
      return `<h3 class="font-medium mt-2">${line.replace(/^###\s+/, "")}</h3>`;
    if (/^##\s+/.test(line))
      return `<h2 class="font-medium text-base mt-2">${line.replace(/^##\s+/, "")}</h2>`;
    if (/^#\s+/.test(line))
      return `<h1 class="font-display text-lg mt-2">${line.replace(/^#\s+/, "")}</h1>`;
    const t = line
      .replace(
        /`([^`]+)`/g,
        '<code class="rounded bg-[var(--inset)] px-1 font-mono text-xs">$1</code>',
      )
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return t ? `<p class="my-1">${t}</p>` : "<br/>";
  });
  return lines.join("") || '<p class="text-[var(--muted)]">(empty)</p>';
}
