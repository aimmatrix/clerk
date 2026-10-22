"use client";

import type { Item } from "@clerk/core";
import { useEffect, useId, useState } from "react";
import { Avatar, headingFont } from "./chips";
import { Modal } from "./modal";

interface ReassignDialogProps {
  item: Item | null;
  owners: string[];
  onSave: (ownerName: string | null) => void;
  onClose: () => void;
}

export function ReassignDialog({ item, owners, onSave, onClose }: ReassignDialogProps) {
  const titleId = useId();
  const listId = useId();
  const [value, setValue] = useState("");

  // Reset only when a different item opens, not when polling refreshes the same one.
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (item) setValue(item.ownerName ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const trimmed = value.trim();
  const unchanged = trimmed === (item?.ownerName ?? "");

  return (
    <Modal open={item !== null} onClose={onClose} labelledBy={titleId}>
      {item ? (
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!unchanged) onSave(trimmed === "" ? null : trimmed);
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold" style={headingFont}>
            Reassign
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.title}</p>

          <label className="mt-5 block text-xs font-medium text-muted-foreground" htmlFor={`${titleId}-owner`}>
            Owner
          </label>
          <input
            id={`${titleId}-owner`}
            data-autofocus
            list={listId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a name, or leave empty for no owner"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <datalist id={listId}>
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>

          {owners.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggested owners">
              {owners.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setValue(o)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-3 text-xs hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Avatar name={o} size={20} />
                  {o}
                </button>
              ))}
            </div>
          ) : null}

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
              disabled={unchanged}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {trimmed === "" ? "Clear owner" : "Reassign"}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
