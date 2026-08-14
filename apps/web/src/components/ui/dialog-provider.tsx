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
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (confirmState) {
      const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [confirmState]);

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
        <DialogContent
          showClose={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!confirmState) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              closeConfirm(false);
              return;
            }
            if (e.key === "Enter") {
              const t = e.target as HTMLElement | null;
              if (t && (t.tagName === "TEXTAREA" || t.isContentEditable)) return;
              e.preventDefault();
              e.stopPropagation();
              closeConfirm(true);
            }
          }}
        >
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
                  className="btn-ghost"
                  onClick={() => closeConfirm(false)}
                >
                  {confirmState.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  className={confirmState.danger ? "btn-danger" : "btn-primary"}
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
        <DialogContent
          showClose={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              closePrompt(null);
            }
          }}
        >
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
                  type={promptState.password ? "password" : "text"}
                  autoComplete={promptState.password ? "current-password" : "off"}
                  className="inset-field mt-1 w-full px-3 py-2"
                  value={promptValue}
                  placeholder={promptState.placeholder}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              </label>
              <DialogFooter>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => closePrompt(null)}
                >
                  {promptState.cancelLabel ?? "Cancel"}
                </button>
                <button type="submit" className="btn-primary">
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
