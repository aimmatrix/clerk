import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/5 text-primary",
        secondary: "border-border bg-sunken text-muted-foreground",
        outline: "border-border bg-surface text-muted-foreground",
        urgent: "border-urgent/25 bg-urgent/5 text-urgent",
        success: "border-success/25 bg-success/5 text-success",
        warning: "border-warning/25 bg-warning/5 text-warning",
        live: "border-border bg-surface text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
