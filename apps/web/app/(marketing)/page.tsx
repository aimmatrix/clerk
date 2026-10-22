import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/clerk/brand/logo";
import { ITEM_TYPES, TypeChip } from "@/components/clerk/brand/type-chip";
import { PriorityBadge } from "@/components/clerk/brand/priority-badge";
import type { ItemType } from "@/components/clerk/brand/types";
import { HeroBoard } from "./_components/hero-board";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/aimmatrix/clerk";
const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? `${GITHUB_URL}#quickstart`;

function GithubMark(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Listen",
    body: "Clerk reads the channels you opt in to, with the last few messages of thread context, and ignores the banter.",
  },
  {
    n: "02",
    title: "Sort",
    body: "Each actionable message becomes a card: type, owner, priority, deadline and a confidence score. Anything unsure goes to the log, not the board.",
  },
  {
    n: "03",
    title: "Approve",
    body: "One keypress to approve, edit, reassign or reject. Nothing is posted publicly until a human says so.",
  },
] as const;

const TYPE_BLURBS: Record<ItemType, string> = {
  request: "Venue for 60, sponsor offers, asks of the organisers.",
  task: "“I’ll grab the pizza.” Owner and deadline captured.",
  event: "Dates, times and places, exportable to your calendar.",
  question: "Unanswered FAQs, with a drafted reply for you to approve.",
  decision: "“We’re moving it to Wednesday.” Recorded, not lost.",
  noise: "Memes and +1s. Counted, hidden, never nagging you.",
};

const LOG_ROWS = [
  { msg: "someone should sort the mic", reason: "Ambiguous owner", confidence: 0.58 },
  { msg: "can we do the thing from last time?", reason: "Low confidence", confidence: 0.41 },
  { msg: "ngl the venue situation is cooked", reason: "Low confidence", confidence: 0.52 },
] as const;

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-x-clip">
        <div className="container grid items-center gap-12 pb-20 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10 lg:pb-28 lg:pt-24">
          <div className="animate-fade-up">
            <Badge variant="live" className="mb-6 gap-2">
              <span className="live-dot" />
              Open source · MIT · Built in London
            </Badge>
            <h1 className="hero-heading">
              Every message.
              <br />
              <span className="text-gradient">Owned.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Clerk turns your community chat into tasks with owners, priorities and deadlines
              — and tells you what it couldn’t handle.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/simulator">
                  Watch demo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                  Add to Discord
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <GithubMark />
                  Star on GitHub
                </a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Self-hostable in 15 minutes. Any LLM provider. Nothing posts without your approval.
            </p>
          </div>

          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl"
            />
            <HeroBoard />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-t border-white/[0.06] py-20">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="section-heading mt-3 max-w-2xl">
            From messy chat to a calm, ranked order.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <Card className="h-full">
                  <CardHeader>
                    <span className="font-mono text-xs text-primary-300">{step.n}</span>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                    <CardDescription className="leading-relaxed">{step.body}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Types */}
      <section aria-labelledby="types-heading" className="border-t border-white/[0.06] py-20">
        <div className="container">
          <p className="eyebrow">Six kinds of message</p>
          <h2 id="types-heading" className="section-heading mt-3 max-w-2xl">
            Clerk knows what each one is for.
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ITEM_TYPES.map((type) => (
              <li key={type} className="glass flex flex-col items-start gap-3 rounded-lg p-4">
                <TypeChip type={type} />
                <p className="text-sm leading-relaxed text-muted-foreground">{TYPE_BLURBS[type]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Honesty */}
      <section aria-labelledby="honest-heading" className="border-t border-white/[0.06] py-20">
        <div className="container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Honest by design</p>
            <h2 id="honest-heading" className="section-heading mt-3">
              What Clerk couldn’t handle — shown, not hidden.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
              Low-confidence guesses never reach your board. They land in a plain log with the
              reason, so you can claim them yourself. A tool you can trust tells you where it
              stopped.
            </p>
            <Button asChild variant="outline" className="mt-7">
              <Link href="/failures">
                See the log
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="glass overflow-hidden rounded-lg">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Example of messages Clerk could not handle</caption>
              <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Message</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Reason</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {LOG_ROWS.map((row) => (
                  <tr key={row.msg}>
                    <td className="px-4 py-3 text-foreground">“{row.msg}”</td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge variant="warning">{row.reason}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular text-urgent">
                      {Math.round(row.confidence * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-white/[0.06] py-24">
        <div className="container">
          <div className="glass relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-hero-glow opacity-80" />
            <div className="mx-auto mb-5 flex items-center justify-center gap-2">
              <PriorityBadge priority="P0" />
              <span className="text-sm text-muted-foreground">Venue for 60, due Fri.</span>
            </div>
            <h2 className="section-heading mx-auto max-w-2xl">
              Another community can run Clerk next week.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Open source, any LLM provider, your own Supabase. Try the simulator first — no
              Discord needed.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/simulator">
                  Watch demo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <GithubMark />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="container flex flex-col items-start justify-between gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Logo size={22} />
          <p>MIT · open source · Built for the Grok Bot Community Engineering London Hackathon</p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground"
          >
            <GithubMark className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
