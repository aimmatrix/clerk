"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Item } from "@clerk/core";
import { Avatar, PriorityBadge, TypeChip, monoFont } from "./chips";
import { formatDueShort, isOverdue } from "./format";
import type { ExitKind } from "./types";

interface ReviewListProps {
  items: Item[];
  selectedId: string | null;
  exitKind: ExitKind;
  onSelect: (id: string) => void;
}

export function ReviewList({ items, selectedId, exitKind, onSelect }: ReviewListProps) {
  const reduced = useReducedMotion();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <ul
      className={items.length > 0 ? "overflow-hidden rounded-xl border border-border bg-surface" : undefined}
      aria-label="Items awaiting review"
    >
      <AnimatePresence initial={false} custom={exitKind}>
        {items.map((item) => {
          const selected = item.id === selectedId;
          const overdue = isOverdue(item.dueAt);
          return (
            <motion.li
              key={item.id}
              layout={!reduced}
              custom={exitKind}
              variants={{
                enter: { opacity: 0, y: reduced ? 0 : 8 },
                show: { opacity: 1, y: 0 },
                exit: (kind: ExitKind) =>
                  reduced
                    ? { opacity: 0 }
                    : kind === "approve"
                      ? { opacity: 0, x: 24, transition: { duration: 0.25 } }
                      : { opacity: 0, y: 8, transition: { duration: 0.2 } },
              }}
              initial="enter"
              animate="show"
              exit="exit"
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={selected ? "true" : undefined}
                className={`relative w-full border-b border-l-2 border-b-border px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  selected ? "border-l-foreground bg-sunken/60" : "border-l-transparent hover:bg-sunken/40"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <TypeChip type={item.type} />
                  <span className="flex items-center gap-3">
                    <PriorityBadge priority={item.priority} short />
                    <span className="text-xs tabular-nums text-subtle" style={monoFont} title="Urgency score">
                      {item.urgencyScore}
                    </span>
                  </span>
                </span>
                <span className="mt-1.5 line-clamp-2 block text-sm font-medium leading-5 text-foreground">
                  {item.title}
                </span>
                <span className="mt-2 flex items-center gap-2 text-xs text-subtle">
                  <Avatar name={item.ownerName} size={20} />
                  <span className={item.ownerName ? "" : "italic"}>{item.ownerName ?? "No owner"}</span>
                  <span aria-hidden>·</span>
                  <span className={overdue ? "text-urgent" : ""}>{formatDueShort(item.dueAt)}</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
