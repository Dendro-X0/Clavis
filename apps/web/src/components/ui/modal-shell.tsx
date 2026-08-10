"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible name for the dialog surface. */
  label: string;
  className?: string;
  /** Default `max-w-lg`; pass e.g. `max-w-md` for narrower panels. */
  panelClassName?: string;
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Full-viewport modal host portaled to `document.body`.
 * Focus trap + Escape + backdrop dismiss; opaque panel surface.
 */
export function ModalShell({
  open,
  onClose,
  children,
  label,
  className,
  panelClassName,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusFirst = () => {
      if (!panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (nodes[0] ?? panel).focus();
    };
    // Defer so portal content is mounted.
    const t = window.setTimeout(focusFirst, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-end justify-center overscroll-contain p-4 sm:items-center",
        "bg-[var(--modal-backdrop)] backdrop-blur-[2px]",
        className,
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          "modal-panel animate-rise flex w-full flex-col rounded-lg border border-[var(--border)] shadow-lg",
          "max-h-[min(85vh,720px)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          panelClassName ?? "max-w-lg",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={label}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span id={titleId} className="sr-only">
          {label}
        </span>
        {children}
      </div>
    </div>,
    document.body,
  );
}
