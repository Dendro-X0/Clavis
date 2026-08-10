"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsField({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("settings-field", className)}>
      <div className="settings-field__head">
        <label htmlFor={htmlFor} className="settings-field__label">
          {label}
        </label>
        {hint ? <p className="settings-field__hint">{hint}</p> : null}
      </div>
      <div className="settings-field__control">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("settings-card", className)}>
      {(title || description) && (
        <div className="settings-card__head">
          {title ? <p className="settings-card__title">{title}</p> : null}
          {description ? <p className="settings-card__desc">{description}</p> : null}
        </div>
      )}
      {children}
    </div>
  );
}

export function SettingsActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("settings-actions", className)}>{children}</div>;
}
