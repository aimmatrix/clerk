"use client";

import { DEMO_COMMUNITY_ID, formatPostBack } from "@clerk/core";
import type { Item } from "@clerk/core";
import { useId } from "react";
import { Kbd, headingFont } from "./chips";
import { Modal } from "./modal";

interface ConfirmPostDialogProps {
  item: Item | null;
  onConfirm: (post: boolean) => void;
  onClose: () => void;
}

export function ConfirmPostDialog({ item, onConfirm, onClose }: ConfirmPostDialogProps) {
  const titleId = useId();
  const destination = item?.communityId === DEMO_COMMUNITY_ID ? "the demo chat" : "Discord";

  const warnings: string[] = [];
  if (item) {
    if ((item.type === "task" || item.type === "request") && !item.ownerName) {
      warnings.push("No owner is set, so the post won't name anyone. Press Cancel, then R to assign one.");
    }
    if (item.type === "question" && !item.suggestedReply) {
      warnings.push("There's no drafted reply to post. Press Cancel, then E to write one.");
    }
  }

  return (
    <Modal open={item !== null} onClose={onClose} labelledBy={titleId}>
      {item ? (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold" style={headingFont}>
            Post to {destination}?
          </h2>
          <p className="mt-1 text-sm text-[#8A90A6]">
            Nothing is posted publicly until you confirm. This is exactly what will be sent:
          </p>
          <blockquote className="mt-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6">
            {formatPostBack(item)}
          </blockquote>
          {warnings.map((w) => (
            <p key={w} className="mt-3 text-xs leading-5 text-[#F59E0B]" role="note">
              {w}
            </p>
          ))}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF]"
            >
              Cancel <Kbd>Esc</Kbd>
            </button>
            <button
              type="button"
              onClick={() => onConfirm(false)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF]"
            >
              Approve only
            </button>
            <button
              type="button"
              data-autofocus
              onClick={() => onConfirm(true)}
              className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A593FF]"
            >
              Approve &amp; post <Kbd>↵</Kbd>
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
