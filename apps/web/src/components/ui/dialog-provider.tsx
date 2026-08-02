"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  registerDialogHost,
  type ConfirmOptions,
  type PromptOptions,
} from "@/lib/app-dialogs";
import { cn } from "@/lib/utils";

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PromptState = PromptOptions & {
  resolve: (value: string | null) => void;
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? "");
      setPromptState({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    registerDialogHost({ confirm, prompt });
    return () => registerDialogHost(null);
  }, [confirm, prompt]);

  useEffect(() => {
    if (promptState) {
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => window.clearTimeout(t);
    }
  }, [promptState]);

  function closeConfirm(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  function closePrompt(result: string | null) {
    promptState?.resolve(result);
    setPromptState(null);
  }

  return (
    <>
      {children}

      <Dialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
      >
        <DialogContent showClose={false} onOpenAutoFocus={(e) => e.preventDefault()}>
          {confirmState && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmState.title}</DialogTitle>
                {confirmState.description && (
                  <DialogDescription>{confirmState.description}</DialogDescription>
                )}
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--inset)]"
                  onClick={() => closeConfirm(false)}
                >
                  {confirmState.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium",
                    confirmState.danger
                      ? "border border-[var(--danger)]/50 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                      : "bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90",
                  )}
                  onClick={() => closeConfirm(true)}
                >
                  {confirmState.confirmLabel ?? "Confirm"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!promptState}
        onOpenChange={(open) => {
          if (!open) closePrompt(null);
        }}
      >
        <DialogContent showClose={false}>
          {promptState && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = promptValue.trim();
                if (!value && promptState.required !== false) return;
                closePrompt(value || null);
              }}
            >
              <DialogHeader>
                <DialogTitle>{promptState.title}</DialogTitle>
                {promptState.description && (
                  <DialogDescription>{promptState.description}</DialogDescription>
                )}
              </DialogHeader>
              <label className="block text-sm" htmlFor={inputId}>
                {promptState.inputLabel ?? "Name"}
                <input
                  id={inputId}
                  ref={inputRef}
                  className="inset-field mt-1 w-full px-3 py-2"
                  value={promptValue}
                  placeholder={promptState.placeholder}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              </label>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--inset)]"
                  onClick={() => closePrompt(null)}
                >
                  {promptState.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-fg)] hover:opacity-90"
                >
                  {promptState.confirmLabel ?? "Save"}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
