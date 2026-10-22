import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { SiteNav } from "@/components/clerk/brand/site-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Clerk — Every message. Owned.",
    template: "%s · Clerk",
  },
  description:
    "Clerk turns your community chat into tasks with owners, priorities and deadlines — and tells you what it couldn't handle. Open source (MIT).",
  applicationName: "Clerk",
  openGraph: {
    title: "Clerk — Every message. Owned.",
    description:
      "Open-source Discord bot and board that turns community chat into owned, prioritised tasks, with a human review queue.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF9",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <TooltipProvider delayDuration={200}>
          <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}><SiteNav /></Suspense>
          <main id="main">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
