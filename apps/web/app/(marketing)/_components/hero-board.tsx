"use client";

import * as React from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import { cn } from "@/components/ui/cn";
import { TypeChip } from "@/components/clerk/brand/type-chip";
import { PriorityBadge } from "@/components/clerk/brand/priority-badge";
import { HERO_ITEMS, INITIALS, NOISE_LINES, type HeroItem } from "./fixtures";

type Stage = "inbox" | "approved" | "posted" | "hidden";

// One loop = 12 ticks: a real message every even tick, chatter on odd ticks.
const LOOP = 12;
const TICK_MS = 1700;
const SPRING: Transition = { type: "spring", stiffness: 260, damping: 24 };

/** Where item `index` is in its life at a given tick (each is offset by 2 ticks). */
function stageAt(index: number, tick: number): Stage {
  const phase = (((tick - index * 2) % LOOP) + LOOP) % LOOP;
  if (phase < 1) return "hidden"; // message has just landed in chat
  if (phase < 4) return "inbox";
  if (phase < 6) return "approved";
  if (phase < 9) return "posted";
  return "hidden";
}

interface FeedLine {
  key: number;
  author: string;
  text: string;
  noise: boolean;
}

function feedAt(tick: number, count: number): FeedLine[] {
  const lines: FeedLine[] = [];
  for (let back = 0; back < count; back++) {
    const t = tick - back;
    if (t < 0) break;
    const slot = ((t % LOOP) + LOOP) % LOOP;
    if (slot % 2 === 0) {
      const item = HERO_ITEMS[slot / 2];
      lines.push({ key: t, author: item.author, text: item.text, noise: false });
    } else {
      const n = NOISE_LINES[(Math.floor(t / LOOP) * 6 + (slot - 1) / 2) % NOISE_LINES.length];
      lines.push({ key: t, author: n.author, text: n.text, noise: true });
    }
  }
  return lines;
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/25 text-[9px] font-semibold text-primary-300",
        className,
      )}
    >
      {INITIALS(name)}
    </span>
  );
}

function confidenceColour(c: number) {
  if (c >= 0.8) return "text-success";
  if (c >= 0.6) return "text-request";
  return "text-urgent";
}

interface MiniCardProps {
  item: HeroItem;
  stage: Exclude<Stage, "hidden">;
  reduce: boolean;
}

function MiniCard({ item, stage, reduce }: MiniCardProps) {
  const approved = stage === "approved";
  const posted = stage === "posted";
  return (
    <motion.div
      layout={!reduce}
      layoutId={reduce ? undefined : `hero-card-${item.id}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -56, scale: 0.9 }}
      animate={{
        opacity: posted ? 0.82 : 1,
        x: 0,
        scale: approved && !reduce ? 1.03 : 1,
      }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={reduce ? { duration: 0.2 } : SPRING}
      className={cn(
        "rounded-lg border bg-[rgb(var(--surface-solid)/0.9)] p-2.5 text-left",
        approved ? "border-success/50 shadow-glow" : "border-white/10",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
        <TypeChip type={item.type} compact />
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="text-xs font-medium leading-snug text-foreground">{item.title}</p>
      {posted ? (
        <p className="mt-2 text-[10px] leading-snug text-success">{item.postBack}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex min-w-0 max-w-full items-center gap-1.5">
            <Avatar name={item.owner ?? "??"} className={item.owner ? "" : "bg-white/10 text-muted-foreground"} />
            <span className="truncate">{item.owner ?? "Unassigned"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-mono tabular">
            {item.due && <span>{item.due}</span>}
            <span className={confidenceColour(item.confidence)}>{Math.round(item.confidence * 100)}%</span>
          </span>
        </div>
      )}
    </motion.div>
  );
}

function Column({
  title,
  count,
  accent,
  className,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-lg bg-black/20 p-2", className)}>
      <div className="flex items-center justify-between px-1 pb-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", accent)} aria-hidden="true" />
          {title}
        </span>
        <span className="font-mono text-[11px] tabular text-muted-foreground">{count}</span>
      </div>
      <div className="flex min-h-[19rem] flex-col gap-2 sm:min-h-[15.5rem]">{children}</div>
    </div>
  );
}

export function HeroBoard({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  // Start mid-loop so the first paint already shows a populated board
  // (identical on server and client — the interval only starts after mount).
  const [tick, setTick] = React.useState(5);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const stages = HERO_ITEMS.map((item, i) => ({ item, stage: stageAt(i, tick) }));
  const inbox = stages.filter((s) => s.stage === "inbox");
  const approved = stages.filter((s) => s.stage === "approved");
  const posted = stages.filter((s) => s.stage === "posted");
  const feed = feedAt(tick, 4);

  const renderColumn = (list: typeof stages) => (
    <AnimatePresence mode="popLayout" initial={false}>
      {list.map(({ item, stage }) => (
        <MiniCard key={item.id} item={item} stage={stage as Exclude<Stage, "hidden">} reduce={reduce} />
      ))}
    </AnimatePresence>
  );

  return (
    <div
      className={cn("glass relative overflow-hidden rounded-2xl p-3 sm:p-4", className)}
      role="img"
      aria-label="Animated preview: chat messages become cards that move from Inbox to Approved to Posted."
    >
      <div aria-hidden="true">
        {/* Window chrome */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <span className="live-dot" />
            Live
          </span>
        </div>

        <LayoutGroup>
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,2.2fr)]">
            {/* Chat strip */}
            <div className="hidden flex-col gap-2 rounded-lg bg-black/20 p-2 md:flex">
              <div className="truncate px-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                #meetup-planning
              </div>
              <div className="flex min-h-[15.5rem] flex-col gap-2 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  {feed.map((line) => (
                    <motion.div
                      key={line.key}
                      layout={!reduce}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
                      animate={{ opacity: line.noise ? 0.45 : 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={reduce ? { duration: 0.2 } : SPRING}
                      className="flex items-start gap-2"
                    >
                      <Avatar name={line.author} className="mt-0.5 h-6 w-6 text-[10px]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground">{line.author}</span>
                          {line.noise && (
                            <span className="rounded bg-noise/30 px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                              ignored
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground">{line.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Mini kanban */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Column title="Inbox" count={inbox.length} accent="bg-primary">
                {renderColumn(inbox)}
              </Column>
              <Column title="Approved" count={approved.length} accent="bg-success">
                {renderColumn(approved)}
              </Column>
              <Column title="Posted" count={posted.length} accent="bg-accent" className="hidden sm:flex">
                {renderColumn(posted)}
              </Column>
            </div>
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}
