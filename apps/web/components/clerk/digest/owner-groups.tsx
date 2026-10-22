'use client';

import type { Item } from '@clerk/core';
import { ItemList, ItemRow, OwnerAvatar } from './digest-section';
import { UNASSIGNED_LABEL, groupByOwner } from './format';

export function OwnerGroups({ items, now }: { items: Item[]; now: Date }) {
  const groups = groupByOwner(items);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => {
        const unassigned = g.owner === UNASSIGNED_LABEL;
        return (
          <div key={g.owner} className="rounded-xl border border-white/5 bg-black/10 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#E8EAF2]">
              <OwnerAvatar name={unassigned ? null : g.owner} size="sm" />
              <span>{g.owner}</span>
              <span className="font-mono text-xs font-normal tabular-nums text-[#8A90A6]">
                {g.items.length} open
              </span>
              {unassigned ? (
                <span className="ml-auto rounded-full bg-[#F59E0B]/15 px-2 py-0.5 text-[11px] text-[#FBBF24]">
                  needs an owner
                </span>
              ) : null}
            </h3>
            <ItemList>
              {g.items.map((item) => (
                <ItemRow key={item.id} item={item} now={now} />
              ))}
            </ItemList>
          </div>
        );
      })}
    </div>
  );
}
