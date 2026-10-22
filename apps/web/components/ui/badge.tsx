import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-300",
        secondary: "border-white/10 bg-white/5 text-muted-foreground",
        outline: "border-white/15 text-foreground",
        urgent: "border-urgent/30 bg-urgent/15 text-urgent",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-request/30 bg-request/15 text-request",
        live: "border-accent/30 bg-accent/10 text-accent",
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
