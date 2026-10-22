import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/clerk/brand/logo";
import { HeroBoard } from "./_components/hero-board";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/clerk-oss/clerk";
const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? `${GITHUB_URL}#quickstart`;

const STEPS = [
  {
    n: "01",
    title: "Listen",
    body: "Clerk reads only the channels you opt in to, with a few messages of thread context. Banter is counted and ignored.",
  },
  {
    n: "02",
    title: "Sort",
    body: "Each actionable message becomes a card with a type, owner, priority, deadline and confidence. Uncertain ones go to a log instead.",
  },
  {
    n: "03",
    title: "Approve",
    body: "One key to approve, edit, reassign or reject. Nothing is posted to the community until a person says so.",
  },
] as const;

const TYPES = [
  { name: "Request", does: "Asks of the organisers, captured with who asked.", example: "“we need a venue for 60”" },
  { name: "Task", does: "Someone commits to doing something. Owner and deadline kept.", example: "“I’ll grab the pizza”" },
  { name: "Event", does: "Dates, times and places, exportable to a calendar.", example: "“Wed 7pm at Second Home”" },
  { name: "Question", does: "Unanswered questions, with a drafted reply to approve.", example: "“is it step-free?”" },
  { name: "Decision", does: "Agreements recorded so they aren’t lost in scroll.", example: "“moving it to Wednesday”" },
  { name: "Noise", does: "Memes and +1s. Counted, hidden, never nagging you.", example: "“lol”" },
] as const;

const LOG_ROWS = [
  { msg: "someone should sort the mic", reason: "No clear owner", confidence: 0.58 },
  { msg: "can we do the thing from last time?", reason: "Low confidence", confidence: 0.41 },
  { msg: "ngl the venue situation is cooked", reason: "Low confidence", confidence: 0.52 },
] as const;

function GithubMark(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const WRAP = "mx-auto w-full max-w-[1120px] px-4 sm:px-8";

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className={`${WRAP} pb-16 pt-20 sm:pt-28`}>
        <p className="eyebrow">Open source · MIT · Discord</p>
        <h1 className="hero-heading mt-6 max-w-[820px]">Every message in your community, owned.</h1>
        <p className="mt-7 max-w-[600px] text-lg leading-relaxed text-muted-foreground">
          Clerk reads your chat and turns requests, tasks and questions into a ranked queue with
          owners and deadlines. You approve what goes public. It tells you what it couldn’t handle.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/simulator">Watch the demo</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
              Add to Discord
            </a>
          </Button>
        </div>
        <p className="mt-5 text-[13px] text-subtle">
          Self-host in about 15 minutes. Works with any LLM provider.
        </p>
      </section>

      <section aria-label="Product preview" className={`${WRAP} pb-28`}>
        <HeroBoard />
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-t border-border">
        <div className={`${WRAP} py-24`}>
          <h2 id="how-heading" className="section-heading max-w-[560px]">
            From a busy channel to a short, ranked list.
          </h2>
          <ol className="mt-14 grid gap-12 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-foreground pt-5">
                <span className="font-mono text-xs text-subtle">{step.n}</span>
                <h3 className="mb-2 mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Types */}
      <section aria-labelledby="types-heading" className="border-t border-border">
        <div className={`${WRAP} py-24`}>
          <h2 id="types-heading" className="section-heading">
            Six kinds of message.
          </h2>
          <p className="mt-3 max-w-[520px] text-muted-foreground">
            Clerk knows what each one is for, and what to do with it.
          </p>
          <ul className="mt-12 border-t border-border">
            {TYPES.map((t) => (
              <li
                key={t.name}
                className="grid gap-1 border-b border-border py-5 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] md:items-baseline md:gap-8"
              >
                <span className="text-base font-semibold">{t.name}</span>
                <span className="text-foreground/80">{t.does}</span>
                <span className="font-mono text-[13px] text-subtle">{t.example}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Honesty */}
      <section aria-labelledby="honest-heading" className="border-t border-border bg-surface">
        <div className={`${WRAP} grid items-start gap-12 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16`}>
          <div>
            <h2 id="honest-heading" className="section-heading">
              When it isn’t sure, it says so.
            </h2>
            <p className="mt-4 max-w-[440px] leading-relaxed text-muted-foreground">
              Clerk never guesses an owner or invents a deadline. Anything below its confidence bar
              is set aside with a plain reason, for someone to claim.
            </p>
            <Link
              href="/failures"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              See the log
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Example of messages Clerk could not handle</caption>
              <tbody className="divide-y divide-border">
                {LOG_ROWS.map((row) => (
                  <tr key={row.msg}>
                    <td className="px-5 py-4">
                      <div>“{row.msg}”</div>
                      <div className="mt-0.5 text-[13px] text-subtle">{row.reason}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs tabular text-muted-foreground">
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
      <section className="border-t border-border">
        <div className={`${WRAP} flex flex-wrap items-end justify-between gap-8 py-28`}>
          <h2 className="max-w-[640px] text-[clamp(1.875rem,4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
            Put your community’s to-do list somewhere you can see it.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                Add to Discord
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GithubMark />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div
          className={`${WRAP} flex flex-col items-start justify-between gap-4 py-7 text-[13px] text-subtle sm:flex-row sm:items-center`}
        >
          <Logo />
          <p>MIT licensed · Built in London</p>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
