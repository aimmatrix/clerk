"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that titles the dialog */
  labelledBy: string;
  /** "right" renders as a drawer */
  placement?: "center" | "right";
  children: ReactNode;
}

/** Minimal accessible dialog: portal, focus trap, Esc to close, focus restore. */
export function Modal({ open, onClose, labelledBy, placement = "center", children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const isDrawer = placement === "right";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-black/30 ${
        isDrawer ? "items-stretch justify-end" : "items-center justify-center p-4"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`border border-border bg-surface text-foreground shadow-pop outline-none ${
          isDrawer ? "h-full w-full max-w-md overflow-y-auto border-y-0 border-r-0" : "w-full max-w-md rounded-2xl"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
