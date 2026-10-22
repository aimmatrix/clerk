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
        sunken: token("sunken"),
        subtle: token("subtle"),
        muted: { DEFAULT: token("sunken"), foreground: token("muted") },
        border: token("line"),
        input: token("line-strong"),
        ring: token("primary"),
        // Brand
        primary: {
          DEFAULT: token("primary"),
          300: token("primary-300"),
          500: token("primary"),
          600: token("primary-600"),
          foreground: "rgb(255 255 255)",
        },
        accent: { DEFAULT: token("accent"), foreground: "rgb(255 255 255)" },
        // Item types (deliberately neutral: types are told apart by label)
        request: token("request"),
        task: token("task"),
        event: token("event"),
        question: token("question"),
        decision: token("decision"),
        noise: token("noise"),
        // Status
        urgent: token("urgent"),
        warning: token("warning"),
        success: token("success"),
        destructive: { DEFAULT: token("urgent"), foreground: "rgb(255 255 255)" },
        popover: { DEFAULT: token("surface-solid"), foreground: token("text") },
        card: { DEFAULT: token("surface"), foreground: token("text") },
      },
      borderRadius: {
        xl: "0.75rem",
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        base: ["0.875rem", { lineHeight: "1.4rem" }], // 14 UI base
      },
      boxShadow: {
        glass: "none",
        glow: "0 0 0 1px rgb(var(--success) / 0.4)",
        "glow-primary": "none",
        pop: "0 8px 24px -8px rgb(24 24 27 / 0.12), 0 1px 2px rgb(24 24 27 / 0.06)",
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
