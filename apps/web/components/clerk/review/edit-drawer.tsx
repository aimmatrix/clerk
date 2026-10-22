"use client";

import type { Item, ItemType, Priority, ReviewRequest } from "@clerk/core";
import { useEffect, useId, useState } from "react";
import { headingFont } from "./chips";
import { PRIORITY_META, PRIORITY_OPTIONS, TYPE_META, TYPE_OPTIONS, fromLondonInput, toLondonInput } from "./format";
import { Modal } from "./modal";

type Patch = NonNullable<ReviewRequest["patch"]>;

interface EditDrawerProps {
  item: Item | null;
  owners: string[];
  onSave: (patch: Patch) => void;
  onClose: () => void;
}

interface Draft {
  title: string;
  type: ItemType;
  priority: Priority;
  ownerName: string;
  due: string;
  suggestedReply: string;
}

function toDraft(item: Item): Draft {
  return {
    title: item.title,
    type: item.type,
    priority: item.priority,
    ownerName: item.ownerName ?? "",
    due: toLondonInput(item.dueAt),
    suggestedReply: item.suggestedReply ?? "",
  };
}

/** Only the fields the reviewer actually changed. */
export function diffDraft(item: Item, draft: Draft): Patch {
  const patch: Patch = {};
  const title = draft.title.trim();
  if (title !== item.title) patch.title = title;
  if (draft.type !== item.type) patch.type = draft.type;
  if (draft.priority !== item.priority) patch.priority = draft.priority;
  const owner = draft.ownerName.trim() || null;
  if (owner !== item.ownerName) patch.ownerName = owner;
  if (draft.due !== toLondonInput(item.dueAt)) patch.dueAt = draft.due ? fromLondonInput(draft.due) : null;
  const reply = draft.suggestedReply.trim() || null;
  if (reply !== item.suggestedReply) patch.suggestedReply = reply;
  return patch;
}

const fieldClass =
  "mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";
const labelClass = "block text-xs font-medium text-muted-foreground";

export function EditDrawer({ item, owners, onSave, onClose }: EditDrawerProps) {
  const id = useId();
  const ownersId = `${id}-owners`;
  const [draft, setDraft] = useState<Draft | null>(null);

  // Reset only when a different item opens. Background polling replaces the item
  // object every few seconds and must never wipe what the reviewer is typing.
  const itemId = item?.id ?? null;
  useEffect(() => {
    setDraft(item ? toDraft(item) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const patch = item && draft ? diffDraft(item, draft) : {};
  const dirty = Object.keys(patch).length > 0;
  const titleValid = (draft?.title.trim().length ?? 0) > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <Modal open={item !== null && draft !== null} onClose={onClose} labelledBy={`${id}-title`} placement="right">
      {item && draft ? (
        <form
          className="flex h-full flex-col p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && titleValid) onSave(patch);
          }}
        >
          <h2 id={`${id}-title`} className="text-lg font-semibold" style={headingFont}>
            Edit item
          </h2>

          <div className="mt-5 flex flex-1 flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor={`${id}-t`}>
                Title <span className="text-muted-foreground">({draft.title.length}/80)</span>
              </label>
              <input
                id={`${id}-t`}
                data-autofocus
                value={draft.title}
                maxLength={80}
                onChange={(e) => set("title", e.target.value)}
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor={`${id}-type`}>
                  Type
                </label>
                <select
                  id={`${id}-type`}
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value as ItemType)}
                  className={fieldClass}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor={`${id}-p`}>
                  Priority
                </label>
                <select
                  id={`${id}-p`}
                  value={draft.priority}
                  onChange={(e) => set("priority", e.target.value as Priority)}
                  className={fieldClass}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor={`${id}-o`}>
                Owner
              </label>
              <input
                id={`${id}-o`}
                list={ownersId}
                value={draft.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                placeholder="No owner"
                autoComplete="off"
                className={fieldClass}
              />
              <datalist id={ownersId}>
                {owners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass} htmlFor={`${id}-d`}>
                Due <span className="text-muted-foreground">(London time)</span>
              </label>
              <input
                id={`${id}-d`}
                type="datetime-local"
                value={draft.due}
                onChange={(e) => set("due", e.target.value)}
                className={`${fieldClass} [color-scheme:light]`}
              />
            </div>

            {draft.type === "question" ? (
              <div>
                <label className={labelClass} htmlFor={`${id}-r`}>
                  Suggested reply
                </label>
                <textarea
                  id={`${id}-r`}
                  rows={5}
                  value={draft.suggestedReply}
                  onChange={(e) => set("suggestedReply", e.target.value)}
                  className={fieldClass}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-surface px-3 py-2 text-sm hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!dirty || !titleValid}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Save changes
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
