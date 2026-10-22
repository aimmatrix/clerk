"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface ToastInput {
  tone: "success" | "error" | "info";
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastEntry extends ToastInput {
  id: number;
}

interface ToastApi {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_COLOUR: Record<ToastInput["tone"], string> = {
  success: "#15803D",
  error: "#C2410C",
  info: "#71717A",
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);
  const reduced = useReducedMotion();

  const dismiss = useCallback((id: number) => setToasts((cur) => cur.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.action ? 10_000 : 5_000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduced}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }}
              transition={{ duration: 0.2 }}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-pop"
                          >
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: TONE_COLOUR[t.tone] }}
              />
              <span className="flex-1 leading-5">{t.message}</span>
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.run();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {t.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md px-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
