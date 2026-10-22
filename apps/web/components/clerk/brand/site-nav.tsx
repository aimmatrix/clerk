"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Logo } from "./logo";

export const NAV_ITEMS = [
  { href: "/board", label: "Board" },
  { href: "/review", label: "Review" },
  { href: "/failures", label: "Couldn't handle" },
  { href: "/digest", label: "Digest" },
  { href: "/simulator", label: "Simulator" },
] as const;

interface CommunityContext {
  id: string;
  name: string;
  discordUrl?: string;
}

export function SiteNav({ liveCommunity }: { liveCommunity?: CommunityContext }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const community = pathname === "/simulator" ? "00000000-0000-0000-0000-000000000001"
    : search.get("communityId") ?? search.get("community") ?? liveCommunity?.id;
  const isSimulator = pathname === "/simulator" || community === "00000000-0000-0000-0000-000000000001";
  const activeCommunity = !isSimulator && liveCommunity?.id === community ? liveCommunity : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-8 px-4 py-2 sm:px-8 md:h-14 md:flex-nowrap md:py-0">
        <Link href="/" className="rounded-md" aria-label="Clerk — home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="no-scrollbar -mx-1 order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto px-1 pt-1 md:order-none md:w-auto md:flex-1 md:pt-0">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={community && item.href !== "/simulator" ? `${item.href}?communityId=${encodeURIComponent(community)}` : item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 rounded-md px-3 py-2 text-[13px] transition-colors sm:text-sm",
                  active
                    ? "bg-sunken font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {pathname === "/" ? (
          <Link
            href={community ? `/board?communityId=${encodeURIComponent(community)}` : "/board"}
            className="shrink-0 rounded-lg bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85"
          >
            Open the board
          </Link>
        ) : activeCommunity ? (
          <a
            href={activeCommunity.discordUrl ?? `/board?communityId=${encodeURIComponent(activeCommunity.id)}`}
            className="ml-auto inline-flex max-w-[210px] shrink-0 items-center gap-2 truncate rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`Open ${activeCommunity.name} in ${activeCommunity.discordUrl ? "Discord" : "the board"}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span className="truncate">{activeCommunity.name}</span>
            {activeCommunity.discordUrl ? <span aria-hidden="true">↗</span> : null}
          </a>
        ) : isSimulator ? (
          <Link
            href="/simulator"
            className="hidden shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
          >
            Simulated chat
          </Link>
        ) : null}
      </div>
    </header>
  );
}
