import type { ItemType, Priority } from "@clerk/core";
import type { ReactNode } from "react";
import { PRIORITY_META, TYPE_META, initials } from "./format";

export const headingFont = {
  fontFamily: "var(--font-space-grotesk, 'Space Grotesk'), ui-sans-serif, system-ui, sans-serif",
} as const;

export const monoFont = {
  fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono'), ui-monospace, SFMono-Regular, monospace",
} as const;

function tint(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export function TypeChip({ type }: { type: ItemType }) {
  const { label, colour } = TYPE_META[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
      style={{ color: colour, background: tint(colour, "1F"), boxShadow: `inset 0 0 0 1px ${tint(colour, "40")}` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} />
      {label}
    </span>
  );
}

export function PriorityBadge({ priority, short = false }: { priority: Priority; short?: boolean }) {
  const { label, colour } = PRIORITY_META[priority];
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color: colour, background: tint(colour, "1F"), ...monoFont }}
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
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
      style={{
        width: size,
        height: size,
        color: known ? "#E8EAF2" : "#F59E0B",
        background: known ? "#7C5CFF40" : "#F59E0B1F",
        boxShadow: known ? "inset 0 0 0 1px #7C5CFF66" : "inset 0 0 0 1px #F59E0B66",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] leading-none text-[#8A90A6]"
      style={monoFont}
    >
      {children}
    </kbd>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour = value >= 0.8 ? "#34D399" : value >= 0.6 ? "#F59E0B" : "#F43F5E";
  return (
    <div className="flex items-center gap-2" title={`Clerk's confidence: ${pct}%`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color: colour, ...monoFont }}>
        {pct}%
      </span>
      <span className="sr-only">confidence</span>
    </div>
  );
}
