import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/ui/dialog-provider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-loaded",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body-loaded",
});

export const metadata: Metadata = {
  title: "Clavis",
  description: "Local-first portable credential vault",
  icons: {
    icon: "/clavis-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-skin="seafoam">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("clavis-skin");if(s==="graphite"||s==="seafoam")document.documentElement.setAttribute("data-skin",s);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${sora.variable} antialiased`}
        style={
          {
            ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif",
            ["--font-body" as string]: "var(--font-body-loaded), Segoe UI, sans-serif",
          } as React.CSSProperties
        }
      >
        <ThemeProvider defaultTheme="system">
          <DialogProvider>{children}</DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
