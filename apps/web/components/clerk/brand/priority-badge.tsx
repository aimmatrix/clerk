import * as React from "react";
import { cn } from "@/components/ui/cn";
import type { Priority } from "./types";

const STYLES: Record<Priority, string> = {
  P0: "border-urgent/40 bg-urgent/15 text-urgent",
  P1: "border-request/40 bg-request/15 text-request",
  P2: "border-question/40 bg-question/15 text-question",
  P3: "border-white/10 bg-white/5 text-muted-foreground",
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
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tracking-wide",
        STYLES[priority],
        className,
      )}
      {...props}
    >
      <span className="sr-only">{NAMES[priority]}: </span>
      {priority}
    </span>
  );
}
