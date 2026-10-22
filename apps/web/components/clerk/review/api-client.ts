import { formatPostBack } from "@clerk/core";
import type { Item, ReviewRequest } from "@clerk/core";
import { makeFixtures } from "./fixtures";
import { isReviewable, sortQueue } from "./queue-logic";
import type { SourceContext } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ReviewClient {
  /** GET /api/items?communityId&status=pending */
  listPending(communityId: string): Promise<Item[]>;
  /** PATCH /api/items/:id */
  review(itemId: string, req: ReviewRequest): Promise<Item>;
  /** POST /api/items/:id/post — server returns 409 unless the item is approved. */
  post(itemId: string, actor: string): Promise<{ posted: true; text: string }>;
  /**
   * GET /api/messages/:messageId/context — NOT in the shared contract yet.
   * Resolves to null when the endpoint is missing so the UI degrades to the item summary.
   */
  getSourceContext(item: Item): Promise<SourceContext | null>;
  icsUrl(itemId: string): string;
}

type FetchLike = typeof fetch;

async function request<T>(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<T> {
  const res = await fetchImpl(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export function createHttpClient(opts: { baseUrl?: string; fetch?: FetchLike } = {}): ReviewClient {
  const base = opts.baseUrl ?? "";
  const doFetch: FetchLike = opts.fetch ?? ((...args) => fetch(...args));

  return {
    async listPending(communityId) {
      const qs = new URLSearchParams({ communityId, status: "pending" });
      const { items } = await request<{ items: Item[] }>(doFetch, `${base}/api/items?${qs}`);
      return items;
    },
    async review(itemId, req) {
      const { item } = await request<{ item: Item }>(doFetch, `${base}/api/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      });
      return item;
    },
    post(itemId, actor) {
      return request<{ posted: true; text: string }>(doFetch, `${base}/api/items/${encodeURIComponent(itemId)}/post`, {
        method: "POST",
        body: JSON.stringify({ actor }),
      });
    },
    async getSourceContext(item) {
      try {
        const qs = new URLSearchParams({ communityId: item.communityId });
        return await request<SourceContext>(
          doFetch,
          `${base}/api/messages/${encodeURIComponent(item.messageId)}/context?${qs}`,
        );
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) return null;
        throw err;
      }
    },
    icsUrl: (itemId) => `${base}/api/items/${encodeURIComponent(itemId)}/ics`,
  };
}

/** In-memory implementation of the contract. Used when NEXT_PUBLIC_REVIEW_MOCK=1. */
export function createMockClient(opts: { latencyMs?: number; now?: Date } = {}): ReviewClient {
  const latency = opts.latencyMs ?? 180;
  const { items: seed, contexts } = makeFixtures(opts.now);
  const store = new Map<string, Item>(seed.map((i) => [i.id, i]));
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, latency));

  const get = (id: string): Item => {
    const item = store.get(id);
    if (!item) throw new ApiError(404, "Item not found");
    return item;
  };

  return {
    async listPending() {
      await wait();
      return sortQueue([...store.values()].filter(isReviewable));
    },
    async review(itemId, req) {
      await wait();
      const current = get(itemId);
      const patched: Item = { ...current, ...(req.patch ?? {}), updatedAt: new Date().toISOString() };
      if (req.action === "approve") patched.status = "approved";
      if (req.action === "reject") patched.status = "rejected";
      if (req.action === "done") patched.status = "done";
      store.set(itemId, patched);
      return patched;
    },
    async post(itemId) {
      await wait();
      const current = get(itemId);
      if (current.status !== "approved") throw new ApiError(409, "Item must be approved before it can be posted");
      store.set(itemId, { ...current, status: "posted", updatedAt: new Date().toISOString() });
      return { posted: true, text: formatPostBack(current) };
    },
    async getSourceContext(item) {
      await wait();
      return contexts[item.messageId] ?? null;
    },
    icsUrl: (itemId) => `/api/items/${encodeURIComponent(itemId)}/ics`,
  };
}

export function getReviewClient(): ReviewClient {
  return process.env.NEXT_PUBLIC_REVIEW_MOCK === "1" ? createMockClient() : createHttpClient();
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Check your connection and try again.";
}
