import * as React from "react";
import { cn } from "@/components/ui/cn";

interface LogoMarkProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

/** The Clerk mark: three ruled lines on an ink square, like a ledger page. */
export function LogoMark({ size = 22, className, ...props }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="22" height="22" rx="6" fill="currentColor" />
      <path
        d="M6 8h10M6 11h10M6 14h6"
        stroke="rgb(var(--bg))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Hide the wordmark and show the mark only. */
  markOnly?: boolean;
  size?: number;
}

export function Logo({ markOnly = false, size = 22, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)} {...props}>
      <LogoMark size={size} />
      {markOnly ? (
        <span className="sr-only">Clerk</span>
      ) : (
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Clerk</span>
      )}
    </span>
  );
}
