"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const THRESHOLD = 56;
const MAX_DRAG = 88;

/**
 * Compact-surface swipe shell: right → onSwipeRight, left → onSwipeLeft.
 * Vertical scroll cancels the gesture.
 */
export function SwipeableRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  className,
  disabled,
}: {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onLongPress?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dx = useRef(0);
  const axis = useRef<"none" | "h" | "v">("none");
  const rowRef = useRef<HTMLDivElement>(null);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  function clearLong() {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  }

  function setOffset(x: number) {
    dx.current = x;
    const el = rowRef.current;
    if (el) el.style.transform = x ? `translateX(${x}px)` : "";
  }

  function reset() {
    clearLong();
    start.current = null;
    axis.current = "none";
    setOffset(0);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || e.button !== 0) return;
    longFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = "none";
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (onLongPress) {
      longTimer.current = setTimeout(() => {
        longFired.current = true;
        onLongPress();
        reset();
      }, 480);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || disabled) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    if (axis.current === "none") {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      axis.current = Math.abs(mx) > Math.abs(my) ? "h" : "v";
      if (axis.current === "v") {
        clearLong();
        start.current = null;
        setOffset(0);
        return;
      }
      clearLong();
    }
    if (axis.current !== "h") return;
    e.preventDefault();
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, mx));
    setOffset(clamped);
  }

  function onPointerUp() {
    if (disabled) {
      reset();
      return;
    }
    const x = dx.current;
    clearLong();
    if (!longFired.current && axis.current === "h") {
      if (x >= THRESHOLD) onSwipeRight?.();
      else if (x <= -THRESHOLD) onSwipeLeft?.();
    }
    reset();
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-[var(--primary)]/15 text-[10px] font-medium tracking-wide text-[var(--primary)] uppercase"
        aria-hidden
      >
        Copy
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[var(--inset)] text-[10px] font-medium tracking-wide text-[var(--muted)] uppercase"
        aria-hidden
      >
        Open
      </div>
      <div
        ref={rowRef}
        className="relative touch-pan-y bg-[var(--background)] transition-transform duration-150 ease-out"
        style={{ background: "var(--card)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
      >
        {children}
      </div>
    </div>
  );
}
