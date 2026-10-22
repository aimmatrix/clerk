import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Colour tokens live in app/globals.css as space-separated RGB channels so that
// Tailwind opacity modifiers (bg-primary/20) work everywhere.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Surfaces & text
        background: token("bg"),
        foreground: token("text"),
        surface: token("surface"),
        muted: { DEFAULT: token("surface"), foreground: token("muted") },
        border: "rgb(255 255 255 / 0.08)",
        input: "rgb(255 255 255 / 0.12)",
        ring: token("primary"),
        // Brand
        primary: {
          DEFAULT: token("primary"),
          300: token("primary-300"),
          500: token("primary"),
          600: token("primary-600"),
          foreground: "rgb(255 255 255)",
        },
        accent: { DEFAULT: token("accent"), foreground: token("bg") },
        // Item types
        request: token("request"),
        task: token("task"),
        event: token("event"),
        question: token("question"),
        decision: token("decision"),
        noise: token("noise"),
        // Status
        urgent: token("urgent"),
        success: token("success"),
        destructive: { DEFAULT: token("urgent"), foreground: "rgb(255 255 255)" },
        popover: { DEFAULT: token("surface-solid"), foreground: token("text") },
        card: { DEFAULT: token("surface"), foreground: token("text") },
      },
      borderRadius: {
        lg: "0.875rem",
        md: "0.625rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "var(--font-space-grotesk)",
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        base: ["0.875rem", { lineHeight: "1.25rem" }], // 14/20 UI base
      },
      boxShadow: {
        glass: "0 8px 32px -8px rgb(0 0 0 / 0.5), inset 0 1px 0 0 rgb(255 255 255 / 0.06)",
        glow: "0 0 0 1px rgb(var(--success) / 0.5), 0 0 32px -4px rgb(var(--success) / 0.45)",
        "glow-primary": "0 0 40px -8px rgb(var(--primary) / 0.6)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(at 20% 10%, #7C5CFF33, transparent 50%), radial-gradient(at 80% 0%, #22D3EE22, transparent 40%)",
      },
      keyframes: {
        "live-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--accent) / 0.6)" },
          "70%": { boxShadow: "0 0 0 8px rgb(var(--accent) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--accent) / 0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.8s ease-out infinite",
        float: "float 6s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [animate],
};

export default config;
