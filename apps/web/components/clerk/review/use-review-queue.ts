"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Item, ReviewRequest } from "@clerk/core";
import { describeError } from "./api-client";
import type { ReviewClient } from "./api-client";
import { isReviewable, pickSelection, sortQueue } from "./queue-logic";
import { useToast } from "./toast";
import type { ExitKind } from "./types";

type Patch = NonNullable<ReviewRequest["patch"]>;

interface Options {
  communityId: string;
  actor: string;
  client: ReviewClient;
  pollMs?: number;
}

interface MutateOptions {
  item: Item;
  request: () => Promise<Item>;
  optimistic: (cur: Item[]) => Item[];
  exit?: ExitKind;
  failure: string;
}

export function useReviewQueue({ communityId, actor, client, pollMs = 6000 }: Options) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [offline, setOffline] = useState(false);
  const [exitKind, setExitKind] = useState<ExitKind>("navigate");
  const [pulse, setPulse] = useState(0);
  const [reviewed, setReviewed] = useState(0);

  const itemsRef = useRef<Item[]>([]);
  const inflight = useRef(0);

  /** Single write path: keeps queue sorted, reviewable-only, and the selection sensible. */
  const apply = useCallback((fn: (cur: Item[]) => Item[]) => {
    const prev = itemsRef.current;
    const next = sortQueue(fn(prev).filter(isReviewable));
    itemsRef.current = next;
    setItems(next);
    setSelectedId((sel) => pickSelection(prev, next, sel));
  }, []);

  const refresh = useCallback(
    async (initial = false) => {
      if (inflight.current > 0) return;
      try {
        const fetched = await client.listPending(communityId);
        if (inflight.current > 0) return;
        const known = new Set(itemsRef.current.map((i) => i.id));
        const arrived = fetched.some((i) => isReviewable(i) && !known.has(i.id));
        apply(() => fetched);
        if (arrived && !initial) setPulse((p) => p + 1);
        setOffline(false);
        setPhase("ready");
      } catch {
        if (initial) setPhase("error");
        else setOffline(true);
      }
    },
    [apply, client, communityId],
  );

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => void refresh(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs]);

  const mutate = useCallback(
    async ({ item, request, optimistic, exit, failure }: MutateOptions): Promise<Item | null> => {
      const snapshot = itemsRef.current;
      inflight.current += 1;
      if (exit) setExitKind(exit);
      apply(optimistic);
      try {
        return await request();
      } catch (err) {
        apply(() => snapshot);
        setExitKind("navigate");
        setSelectedId(item.id);
        toast.push({ tone: "error", message: `${failure} ${describeError(err)}` });
        return null;
      } finally {
        inflight.current -= 1;
      }
    },
    [apply, toast],
  );

  const postItem = useCallback(
    async function run(item: Item): Promise<boolean> {
      inflight.current += 1;
      try {
        const res = await client.post(item.id, actor);
        toast.push({ tone: "success", message: res.text ? `Posted: ${res.text}` : "Posted." });
        return true;
      } catch (err) {
        toast.push({
          tone: "error",
          message: `Approved, but posting failed. ${describeError(err)}`,
          action: { label: "Retry post", run: () => void run(item) },
        });
        return false;
      } finally {
        inflight.current -= 1;
      }
    },
    [actor, client, toast],
  );

  const select = useCallback((id: string) => {
    setExitKind("navigate");
    setSelectedId(id);
  }, []);

  const move = useCallback(
    (delta: 1 | -1) => {
      const list = itemsRef.current;
      if (list.length === 0) return;
      const idx = list.findIndex((i) => i.id === selectedId);
      const next = list[Math.min(list.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + delta))];
      if (next) select(next.id);
    },
    [select, selectedId],
  );

  const approve = useCallback(
    async (item: Item, post: boolean) => {
      const saved = await mutate({
        item,
        exit: "approve",
        failure: "Couldn't approve.",
        optimistic: (cur) => cur.filter((i) => i.id !== item.id),
        request: () => client.review(item.id, { action: "approve", actor }),
      });
      if (!saved) return;
      setReviewed((n) => n + 1);
      if (post) {
        await postItem(item);
      } else {
        toast.push({
          tone: "success",
          message: `Approved “${item.title}”. Nothing has been posted yet.`,
          action: { label: "Post now", run: () => void postItem(item) },
        });
      }
    },
    [actor, client, mutate, postItem, toast],
  );

  const reject = useCallback(
    async (item: Item) => {
      const saved = await mutate({
        item,
        exit: "reject",
        failure: "Couldn't reject.",
        optimistic: (cur) => cur.filter((i) => i.id !== item.id),
        request: () => client.review(item.id, { action: "reject", actor }),
      });
      if (saved) {
        setReviewed((n) => n + 1);
        toast.push({ tone: "info", message: `Rejected “${item.title}”.` });
      }
    },
    [actor, client, mutate, toast],
  );

  const patchItem = useCallback(
    async (item: Item, action: "edit" | "reassign", patch: Patch, failure: string, success: string) => {
      const saved = await mutate({
        item,
        failure,
        optimistic: (cur) => cur.map((i) => (i.id === item.id ? { ...i, ...patch } : i)),
        request: () => client.review(item.id, { action, patch, actor }),
      });
      if (!saved) return;
      apply((cur) => cur.map((i) => (i.id === saved.id ? saved : i)));
      toast.push({
        tone: "success",
        message: saved.type === "noise" ? "Marked as noise. It's now hidden from the queue." : success,
      });
    },
    [actor, apply, client, mutate, toast],
  );

  const edit = useCallback(
    (item: Item, patch: Patch) => patchItem(item, "edit", patch, "Couldn't save changes.", "Changes saved."),
    [patchItem],
  );

  const reassign = useCallback(
    (item: Item, ownerName: string | null) =>
      patchItem(
        item,
        "reassign",
        { ownerName },
        "Couldn't reassign.",
        ownerName ? `Reassigned to ${ownerName}.` : "Owner cleared.",
      ),
    [patchItem],
  );

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const index = selected ? items.findIndex((i) => i.id === selected.id) : -1;

  return {
    items,
    selected,
    index,
    phase,
    offline,
    exitKind,
    pulse,
    reviewed,
    select,
    move,
    approve,
    reject,
    edit,
    reassign,
    retry: () => {
      setPhase("loading");
      void refresh(true);
    },
  };
}
