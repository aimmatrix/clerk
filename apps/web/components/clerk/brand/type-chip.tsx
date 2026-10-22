import * as React from "react";
import { cn } from "@/components/ui/cn";
import type { ItemType } from "./types";

const LABELS: Record<ItemType, string> = {
  request: "Request",
  task: "Task",
  event: "Event",
  question: "Question",
  decision: "Decision",
  noise: "Noise",
};

export const ITEM_TYPES = Object.keys(LABELS) as ItemType[];

export function typeLabel(type: ItemType): string {
  return LABELS[type];
}

export interface TypeChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: ItemType;
  /** Slightly smaller, for dense cards. */
  compact?: boolean;
}

/** Item type as a quiet mono label. Types are told apart by name, not colour. */
export function TypeChip({ type, compact = false, className, ...props }: TypeChipProps) {
  return (
    <span
      data-type={type}
      className={cn(
        "inline-flex items-center font-mono uppercase leading-none tracking-[0.05em]",
        type === "noise" ? "text-subtle" : "text-muted-foreground",
        compact ? "text-[10px]" : "text-[11px]",
        className,
      )}
      {...props}
    >
      {LABELS[type]}
    </span>
  );
}
