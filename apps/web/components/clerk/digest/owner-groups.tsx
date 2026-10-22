'use client';

import type { Item } from '@clerk/core';
import { ItemList, ItemRow, OwnerAvatar } from './digest-section';
import { UNASSIGNED_LABEL, groupByOwner } from './format';

export function OwnerGroups({ items, now }: { items: Item[]; now: Date }) {
  const groups = groupByOwner(items);
  return (
    <div>
      {groups.map((g) => {
        const unassigned = g.owner === UNASSIGNED_LABEL;
        return (
          <div key={g.owner} className="pt-5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <OwnerAvatar name={unassigned ? null : g.owner} size="sm" />
              <span>{g.owner}</span>
              <span className="font-mono text-xs font-normal tabular-nums text-subtle">
                {g.items.length} open
              </span>
              {unassigned ? (
                <span className="ml-auto text-xs font-normal text-warning">
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
