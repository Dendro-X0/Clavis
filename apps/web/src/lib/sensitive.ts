import type { UpsertEntryInput } from "@/lib/api";

/** Empty entry editor payload (no secrets). */
export function blankEntryForm(): UpsertEntryInput {
  return {
    entryType: "login",
    title: "",
    username: "",
    password: "",
    url: "",
    notes: "",
    tags: [],
    customFields: [],
    otpSecret: "",
  };
}

/**
 * Best-effort UI scrub: drop secret-bearing fields from a form snapshot.
 * JavaScript strings are immutable — this only clears React state references.
 */
export function scrubEntryForm(form: UpsertEntryInput): UpsertEntryInput {
  return {
    ...form,
    password: "",
    notes: "",
    otpSecret: "",
    customFields: (form.customFields ?? []).map((f) => ({
      label: f.label,
      value: "",
    })),
  };
}
