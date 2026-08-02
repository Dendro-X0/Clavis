"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: ReactNode;
  defaultTheme?: "light" | "dark" | "system";
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
