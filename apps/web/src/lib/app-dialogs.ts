export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type PromptOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  inputLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true (default), empty submit is ignored. */
  required?: boolean;
};

type DialogHost = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

let host: DialogHost | null = null;

export function registerDialogHost(next: DialogHost | null) {
  host = next;
}

export async function appConfirm(options: ConfirmOptions): Promise<boolean> {
  if (!host) {
    throw new Error("Dialog host is not mounted.");
  }
  return host.confirm(options);
}

export async function appPrompt(options: PromptOptions): Promise<string | null> {
  if (!host) {
    throw new Error("Dialog host is not mounted.");
  }
  return host.prompt(options);
}
