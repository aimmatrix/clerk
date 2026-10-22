import * as React from "react";
import { cn } from "@/components/ui/cn";

interface LogoMarkProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

/** The Clerk mark: a "C" of chat-bubble arc with a ticked-off dot. */
export function LogoMark({ size = 28, className, ...props }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="clerk-mark-bg" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8F73FF" />
          <stop offset="1" stopColor="#5B3FE0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#clerk-mark-bg)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="white" strokeOpacity="0.2" />
      <path
        d="M21.5 11.2A7 7 0 1 0 21.5 20.8"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="22.2" cy="16" r="2.3" fill="#22D3EE" />
    </svg>
  );
}

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Hide the wordmark and show the mark only. */
  markOnly?: boolean;
  size?: number;
}

export function Logo({ markOnly = false, size = 28, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} {...props}>
      <LogoMark size={size} />
      {markOnly ? (
        <span className="sr-only">Clerk</span>
      ) : (
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Clerk
        </span>
      )}
    </span>
  );
}
