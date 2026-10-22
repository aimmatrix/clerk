"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Item } from "@clerk/core";
import { Avatar, PriorityBadge, TypeChip, monoFont } from "./chips";
import { TYPE_META, formatDueShort, isOverdue } from "./format";
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
    <ul className="flex flex-col gap-2" aria-label="Items awaiting review">
      <AnimatePresence initial={false} custom={exitKind}>
        {items.map((item) => {
          const selected = item.id === selectedId;
          const colour = TYPE_META[item.type].colour;
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
                className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF] ${
                  selected
                    ? "border-[#7C5CFF]/60 bg-[#7C5CFF]/10"
                    : "border-white/[0.08] bg-[#141826]/60 hover:bg-[#141826]/90"
                }`}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: colour }} />
                <span className="flex items-center gap-2">
                  <TypeChip type={item.type} />
                  <PriorityBadge priority={item.priority} short />
                  <span
                    className="ml-auto text-xs tabular-nums text-[#8A90A6]"
                    style={monoFont}
                    title="Urgency score"
                  >
                    {item.urgencyScore}
                  </span>
                </span>
                <span className="mt-2 line-clamp-2 block text-sm font-medium leading-5 text-[#E8EAF2]">
                  {item.title}
                </span>
                <span className="mt-2 flex items-center gap-2 text-xs text-[#8A90A6]">
                  <Avatar name={item.ownerName} size={20} />
                  <span className={item.ownerName ? "" : "text-[#F59E0B]"}>{item.ownerName ?? "No owner"}</span>
                  <span aria-hidden>·</span>
                  <span className={overdue ? "text-[#F43F5E]" : ""}>{formatDueShort(item.dueAt)}</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
