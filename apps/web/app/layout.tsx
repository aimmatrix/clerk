import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { GlowBackground } from "@/components/clerk/brand/glow-background";
import { SiteNav } from "@/components/clerk/brand/site-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/cn";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
  themeColor: "#0B0D14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={cn("dark", inter.variable, spaceGrotesk.variable, jetbrainsMono.variable)}
    >
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <GlowBackground />
        <TooltipProvider delayDuration={200}>
          <SiteNav />
          <main id="main">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
