import { cn } from "@/components/ui/cn";

export interface GlowBackgroundProps {
  className?: string;
  /** "page" is fixed behind everything; "section" fills a relative parent. */
  variant?: "page" | "section";
}

/** Decorative gradient glow + faint grid. Purely visual, hidden from AT. */
export function GlowBackground({ className, variant = "page" }: GlowBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none inset-0 -z-10 overflow-hidden",
        variant === "page" ? "fixed" : "absolute",
        className,
      )}
    >
      <div className="absolute inset-0 bg-hero-glow" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-32 top-2/3 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
    </div>
  );
}
