"use client";

import { useEffect } from "react";
import { applyDocumentSkin, normalizeSkin, readStoredSkin, type AppSkin } from "@/lib/skin";

/** Keeps `html[data-skin]` in sync with settings (and localStorage for fast boot). */
export function SkinApplier({ skin }: { skin?: string | null }) {
  useEffect(() => {
    const next: AppSkin = skin != null && skin !== "" ? normalizeSkin(skin) : readStoredSkin();
    applyDocumentSkin(next);
  }, [skin]);

  return null;
}
