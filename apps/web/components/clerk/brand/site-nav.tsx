"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export const NAV_ITEMS = [
  { href: "/board", label: "Board" },
  { href: "/review", label: "Review" },
  { href: "/failures", label: "Couldn't handle" },
  { href: "/digest", label: "Digest" },
  { href: "/simulator", label: "Simulator" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <div className="container flex flex-wrap items-center justify-between gap-x-4 py-2 md:h-14 md:flex-nowrap md:py-0">
        <Link href="/" className="rounded-md" aria-label="Clerk — home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="no-scrollbar -mx-1 order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto px-1 pt-1 md:order-none md:w-auto md:flex-1 md:justify-center md:pt-0">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button asChild size="sm" className="hidden shrink-0 lg:inline-flex">
          <Link href="/simulator">Watch demo</Link>
        </Button>
      </div>
    </header>
  );
}
