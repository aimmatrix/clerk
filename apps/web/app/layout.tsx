import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { SiteNav } from "@/components/clerk/brand/site-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { getSupabaseService } from "@/lib/supabase-server";

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

// Navigation metadata should never hold the whole page behind a slow database.
const loadNavCommunity = unstable_cache(async (id: string) => {
  const db = getSupabaseService();
  if (!db) return null;
  const { data, error } = await db.from("communities")
    .select("id, name, discord_guild_id, post_channel_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}, ["clerk-nav-community"], { revalidate: 60 });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const communityId = process.env.COMMUNITY_ID;
  let liveCommunity: { id: string; name: string; discordUrl?: string } | undefined;
  if (communityId) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const community = await Promise.race([
      loadNavCommunity(communityId),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1500); }),
    ]).catch(() => null).finally(() => clearTimeout(timer));
    if (community) {
      const guild = community.discord_guild_id;
      const channel = community.post_channel_id;
      liveCommunity = {
        id: community.id,
        name: community.name,
        discordUrl: /^\d+$/.test(guild ?? "") && /^\d+$/.test(channel ?? "")
          ? `https://discord.com/channels/${guild}/${channel}` : undefined,
      };
    }
  }
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
          <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}><SiteNav liveCommunity={liveCommunity} /></Suspense>
          <main id="main">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
