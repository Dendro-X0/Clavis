/** Copy text via Tauri clipboard when available, else browser clipboard. */
export async function copyToClipboard(text: string): Promise<void> {
  if (!text) throw new Error("Nothing to copy.");
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

export async function readClipboardText(): Promise<string> {
  try {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return await readText();
  } catch {
    return navigator.clipboard.readText();
  }
}

export type ClipboardEntryFields = {
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  tags?: string[];
};

/** Labeled block of all entry fields — paste into notes, forms, or unlock flows. */
export function formatEntryForClipboard(entry: ClipboardEntryFields): string {
  const lines: string[] = [];
  if (entry.title?.trim()) lines.push(`Name: ${entry.title.trim()}`);
  if (entry.username?.trim()) lines.push(`Username: ${entry.username.trim()}`);
  if (entry.password) lines.push(`Password: ${entry.password}`);
  if (entry.url?.trim()) lines.push(`URL: ${entry.url.trim()}`);
  if (entry.notes?.trim()) lines.push(`Notes:\n${entry.notes.trim()}`);
  if (entry.tags?.length) {
    lines.push(`Categories: ${entry.tags.filter(Boolean).join(", ")}`);
  }
  if (!lines.length) throw new Error("Nothing to copy.");
  return lines.join("\n");
}

function matchLabel(line: string, labels: string[]): string | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const key = line.slice(0, idx).trim().toLowerCase();
  const value = line.slice(idx + 1).trim();
  for (const label of labels) {
    if (key === label.toLowerCase()) return value;
  }
  return null;
}

/**
 * Parse a labeled credential block. Missing fields are omitted (not cleared).
 * Safe for partial pastes — only recognized labels are returned.
 */
export function parseLabeledCredentialFields(text: string): ClipboardEntryFields {
  const out: ClipboardEntryFields = {};
  const noteLines: string[] = [];
  let inNotes = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (inNotes) noteLines.push("");
      continue;
    }

    const name = matchLabel(trimmed, ["Name", "Title", "Display name"]);
    if (name !== null) {
      inNotes = false;
      if (name) out.title = name;
      continue;
    }
    const username = matchLabel(trimmed, ["Username", "User name", "User", "Account", "Login"]);
    if (username !== null) {
      inNotes = false;
      if (username) out.username = username;
      continue;
    }
    const email = matchLabel(trimmed, ["Email", "E-mail", "Mail"]);
    if (email !== null) {
      inNotes = false;
      // Prefer email as username when username not already set.
      if (email) {
        if (!out.username) out.username = email;
        else if (!out.notes) noteLines.push(`Email: ${email}`);
      }
      continue;
    }
    const password = matchLabel(trimmed, ["Password", "Pass", "Pwd"]);
    if (password !== null) {
      inNotes = false;
      if (password) out.password = password;
      continue;
    }
    const url = matchLabel(trimmed, ["URL", "Website", "Site", "Link"]);
    if (url !== null) {
      inNotes = false;
      if (url) out.url = url;
      continue;
    }
    const categories = matchLabel(trimmed, ["Categories", "Category", "Tags", "Tag"]);
    if (categories !== null) {
      inNotes = false;
      out.tags = categories
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }
    const notes = matchLabel(trimmed, ["Notes", "Note", "Comment"]);
    if (notes !== null) {
      inNotes = true;
      if (notes) noteLines.push(notes);
      continue;
    }

    if (inNotes) {
      noteLines.push(line);
      continue;
    }
  }

  const notesJoined = noteLines.join("\n").trim();
  if (notesJoined) out.notes = notesJoined;
  return out;
}

/** True when at least one credential field was recognized. */
export function hasParsedCredentialFields(fields: ClipboardEntryFields): boolean {
  return Boolean(
    fields.title ||
      fields.username ||
      fields.password ||
      fields.url ||
      fields.notes ||
      (fields.tags && fields.tags.length),
  );
}
