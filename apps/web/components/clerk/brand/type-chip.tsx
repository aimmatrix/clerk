import * as React from "react";
import { cn } from "@/components/ui/cn";
import type { ItemType } from "./types";

// Full class strings (not interpolated) so Tailwind can see them at build time.
const STYLES: Record<ItemType, { chip: string; dot: string; label: string }> = {
  request: {
    chip: "border-request/30 bg-request/15 text-request",
    dot: "bg-request",
    label: "Request",
  },
  task: {
    chip: "border-task/30 bg-task/15 text-primary-300",
    dot: "bg-task",
    label: "Task",
  },
  event: {
    chip: "border-event/30 bg-event/15 text-event",
    dot: "bg-event",
    label: "Event",
  },
  question: {
    chip: "border-question/30 bg-question/15 text-question",
    dot: "bg-question",
    label: "Question",
  },
  decision: {
    chip: "border-decision/30 bg-decision/15 text-decision",
    dot: "bg-decision",
    label: "Decision",
  },
  noise: {
    chip: "border-noise/50 bg-noise/20 text-muted-foreground",
    dot: "bg-noise",
    label: "Noise",
  },
};

export const ITEM_TYPES = Object.keys(STYLES) as ItemType[];

export function typeLabel(type: ItemType): string {
  return STYLES[type].label;
}

export interface TypeChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: ItemType;
  /** Dot + short label at a smaller size, for dense cards. */
  compact?: boolean;
}

export function TypeChip({ type, compact = false, className, ...props }: TypeChipProps) {
  const s = STYLES[type];
  return (
    <span
      data-type={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium leading-none",
        compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-xs",
        s.chip,
        className,
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}
