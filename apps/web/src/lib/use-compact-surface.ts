"use client";

import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

/** True when viewport is phone-width — shared by Tauri mobile WebView and narrow desktop. */
export function useCompactSurface() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return compact;
}
