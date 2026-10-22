import type { Item } from "@clerk/core";

/** The review queue only shows pending, non-noise items. */
export function isReviewable(item: Item): boolean {
  return item.status === "pending" && item.type !== "noise";
}

/** Most urgent first; ties broken by oldest, then id, so ordering is stable. */
export function sortQueue(items: Item[]): Item[] {
  return [...items].sort(
    (a, b) =>
      b.urgencyScore - a.urgencyScore ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Keep the current selection if it survives; otherwise land on the item that
 * slid into its slot (or the last one), so clearing the queue never jumps to the top.
 */
export function pickSelection(prev: Item[], next: Item[], selectedId: string | null): string | null {
  if (selectedId && next.some((i) => i.id === selectedId)) return selectedId;
  const oldIndex = selectedId ? prev.findIndex((i) => i.id === selectedId) : -1;
  if (oldIndex >= 0 && next.length > 0) return next[Math.min(oldIndex, next.length - 1)]?.id ?? null;
  return next[0]?.id ?? null;
}

export function knownOwners(items: Item[], extra: string[] = []): string[] {
  const set = new Set<string>();
  for (const name of [...items.map((i) => i.ownerName), ...extra]) {
    if (name && name.trim()) set.add(name.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
