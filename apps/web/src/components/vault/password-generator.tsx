"use client";

import { useEffect, useState } from "react";
import {
  api,
  type GenerateOptions,
  type GeneratorPreset,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_DEFAULTS: Record<GeneratorPreset, Partial<GenerateOptions>> = {
  strong: { length: 20, uppercase: true, lowercase: true, digits: true, symbols: true },
  passphrase: { length: 5 },
  pin: { length: 6 },
};

export function PasswordGeneratorPanel({
  open,
  onClose,
  onApply,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (password: string) => void;
  onError: (e: string) => void;
}) {
  const [preset, setPreset] = useState<GeneratorPreset>("strong");
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setPreview("");
      setHistory([]);
      return;
    }
    void regenerate();
    api.generatorHistory().then(setHistory).catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only refresh
  }, [open]);

  useEffect(() => {
    return () => {
      setPreview("");
    };
  }, []);

  function applyPreset(next: GeneratorPreset) {
    setPreset(next);
    const defaults = PRESET_DEFAULTS[next];
    if (defaults.length != null) setLength(defaults.length);
    if (next === "strong") {
      setUppercase(true);
      setLowercase(true);
      setDigits(true);
      setSymbols(true);
    }
  }

  async function regenerate() {
    try {
      const options: GenerateOptions = {
        preset,
        length,
        uppercase,
        lowercase,
        digits,
        symbols,
        avoidAmbiguous,
      };
      const pw = await api.generatePassword(options);
      setPreview(pw);
      const hist = await api.generatorHistory();
      setHistory(hist);
    } catch (e) {
      onError(String(e).replace(/^Error:\s*/, ""));
    }
  }

  if (!open) return null;

  const lengthLabel =
    preset === "passphrase" ? "Words" : preset === "pin" ? "Digits" : "Length";
  const lengthMin = preset === "passphrase" ? 3 : preset === "pin" ? 4 : 8;
  const lengthMax = preset === "passphrase" ? 12 : preset === "pin" ? 12 : 128;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="animate-rise w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg"
        role="dialog"
        aria-label="Password generator"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg">Password generator</h3>
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => {
              setPreview("");
              onClose();
            }}
          >
            Close
          </button>
        </div>

        <label className="mt-4 block text-sm">
          Preset
          <Select value={preset} onValueChange={(v) => applyPreset(v as GeneratorPreset)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strong">Strong</SelectItem>
              <SelectItem value="passphrase">Passphrase</SelectItem>
              <SelectItem value="pin">PIN</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="mt-3 block text-sm">
          {lengthLabel}
          <input
            type="number"
            min={lengthMin}
            max={lengthMax}
            className="inset-field mt-1 w-full px-3 py-2"
            value={length}
            onChange={(e) => setLength(Number(e.target.value) || lengthMin)}
          />
        </label>

        {preset === "strong" && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
              Uppercase
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} />
              Lowercase
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} />
              Digits
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} />
              Symbols
            </label>
            <label className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={avoidAmbiguous}
                onChange={(e) => setAvoidAmbiguous(e.target.checked)}
              />
              Avoid ambiguous (0/O, 1/l/I)
            </label>
          </div>
        )}

        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--inset)] px-3 py-2 font-mono text-sm break-all">
          {preview || "—"}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--inset)]"
            onClick={() => regenerate().catch((e) => onError(String(e)))}
          >
            Regenerate
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg,white)]"
            disabled={!preview}
            onClick={() => {
              if (!preview) return;
              onApply(preview);
              setPreview("");
              onClose();
            }}
          >
            Use in editor
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-xs text-[var(--muted)]">Session history (wiped on lock)</p>
            <ul className="mt-2 space-y-1">
              {[...history].reverse().map((h, i) => (
                <li key={`${i}-${h.slice(0, 4)}`}>
                  <button
                    type="button"
                    className="w-full truncate rounded px-2 py-1 text-left font-mono text-xs hover:bg-[var(--inset)]"
                    onClick={() => {
                      onApply(h);
                      setPreview("");
                      onClose();
                    }}
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
