import type { ItemType, Priority } from "@clerk/core";
import type { ReactNode } from "react";
import { PRIORITY_META, TYPE_META, initials } from "./format";

export const headingFont = {
  fontFamily: "var(--font-sans, 'Geist Variable'), ui-sans-serif, system-ui, sans-serif",
} as const;

export const monoFont = {
  fontFamily: "var(--font-mono, 'Geist Mono Variable'), ui-monospace, SFMono-Regular, monospace",
} as const;

export function TypeChip({ type }: { type: ItemType }) {
  const { label } = TYPE_META[type];
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground" style={monoFont}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority, short = false }: { priority: Priority; short?: boolean }) {
  const { label, colour } = PRIORITY_META[priority];
  return (
    <span
      className={`text-[11px] ${priority === "P0" ? "font-semibold" : "font-medium"}`}
      style={{ color: colour, ...monoFont }}
    >
      {short ? priority : label}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const known = Boolean(name);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
        known ? "bg-sunken text-muted-foreground" : "border border-dashed border-input text-subtle"
      }`}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="rounded border border-input bg-surface px-1.5 py-0.5 text-[11px] leading-none text-subtle"
      style={monoFont}
    >
      {children}
    </kbd>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour = value >= 0.8 ? "#52525B" : value >= 0.6 ? "#B45309" : "#C2410C";
  return (
    <div className="flex items-center gap-2" title={`Clerk's confidence: ${pct}%`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color: colour, ...monoFont }}>
        {pct}%
      </span>
      <span className="sr-only">confidence</span>
    </div>
  );
}
