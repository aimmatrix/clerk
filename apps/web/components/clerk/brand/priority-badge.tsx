import * as React from "react";
import { cn } from "@/components/ui/cn";
import type { Priority } from "./types";

// Only P0 gets colour; the rest step down in weight so the eye lands on what's urgent.
const STYLES: Record<Priority, string> = {
  P0: "text-urgent font-semibold",
  P1: "text-foreground font-medium",
  P2: "text-muted-foreground font-medium",
  P3: "text-subtle",
};

const NAMES: Record<Priority, string> = {
  P0: "Critical priority",
  P1: "High priority",
  P2: "Medium priority",
  P3: "Low priority",
};

export interface PriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: Priority;
}

export function PriorityBadge({ priority, className, ...props }: PriorityBadgeProps) {
  return (
    <span
      title={NAMES[priority]}
      className={cn("inline-flex items-center font-mono text-[11px] leading-none", STYLES[priority], className)}
      {...props}
    >
      <span className="sr-only">{NAMES[priority]}: </span>
      {priority}
    </span>
  );
}
