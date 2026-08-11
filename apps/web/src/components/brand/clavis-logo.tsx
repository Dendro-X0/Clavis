import { cn } from "@/lib/utils";

/**
 * Security mark: polygonal shield with a nested geometric lock.
 * Fills use `--primary` / `--primary-fg` for skins and light/dark.
 */
export function ClavisMark({
  className,
  title = "Clavis",
  decorative = false,
}: {
  className?: string;
  title?: string;
  /** When true, hide from AT (e.g. next to a visible wordmark). */
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      {!decorative ? <title>{title}</title> : null}
      {/* Pointed polygonal shield */}
      <path
        fill="var(--primary)"
        d="M16 2.2 27.6 6.8v9.4L21.8 22.6 16 29.6 10.2 22.6 4.4 16.2V6.8Z"
      />
      {/* Lock shackle (angular U) */}
      <path
        fill="var(--primary-fg)"
        fillRule="evenodd"
        d="M11.4 14.4V10.6L13.6 8.2h4.8L20.6 10.6v3.8h-1.9V11.2L17.6 10h-3.2l-1.1 1.2v3.2H11.4Z"
      />
      {/* Lock body */}
      <path fill="var(--primary-fg)" d="M10.2 14.2h11.6v8.6H10.2Z" />
      {/* Keyway */}
      <path fill="var(--primary)" d="M14.4 17h3.2v3.8h-3.2Z" />
    </svg>
  );
}

export function ClavisLogo({
  className,
  markClassName,
  wordmark = true,
  size = "md",
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const markSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const textSize =
    size === "sm" ? "text-[15px]" : size === "lg" ? "text-3xl" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <ClavisMark className={cn(markSize, markClassName)} decorative={wordmark} />
      {wordmark ? (
        <span className={cn("font-display tracking-tight text-[var(--foreground)]", textSize)}>
          Clavis
        </span>
      ) : null}
    </div>
  );
}
