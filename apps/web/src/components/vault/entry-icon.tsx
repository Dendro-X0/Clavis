"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function hostFromUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function letterFrom(title: string, host: string | null): string {
  const source = (host ?? title).trim();
  const c = source.charAt(0);
  return (c || "?").toUpperCase();
}

export function EntryIcon({
  title,
  url,
  fetchEnabled,
  className,
}: {
  title: string;
  url: string;
  fetchEnabled?: boolean;
  className?: string;
}) {
  const host = hostFromUrl(url);
  const letter = letterFrom(title, host);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    if (!host) return;

    (async () => {
      try {
        let data = await api.readEntryIcon(host);
        if (!data && fetchEnabled) {
          data = await api.fetchEntryIcon(host);
        }
        if (!cancelled && data) setSrc(data);
      } catch {
        /* lettermark fallback */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [host, fetchEnabled]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn("h-8 w-8 shrink-0 rounded-md object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-wash)] text-xs font-semibold text-[var(--primary)]",
        className,
      )}
    >
      {letter}
    </span>
  );
}
