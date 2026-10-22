'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { DEMO_COMMUNITY, DigestChangedError, postDigest } from './api-client';
import { ConfirmPostDialog } from './confirm-post-dialog';
import { DigestSection, EmptyNote, ItemList, ItemRow } from './digest-section';
import { formatGenerated, sortByUrgency } from './format';
import { digestToDiscordMarkdown } from './markdown';
import { OwnerGroups } from './owner-groups';
import { StatStrip } from './stat-strip';
import { useDigest } from './use-digest';

const DEFAULT_COMMUNITY = process.env.NEXT_PUBLIC_DEMO_COMMUNITY_ID ?? DEMO_COMMUNITY;

type Toast = { kind: 'success' | 'error'; text: string } | null;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be blocked (insecure origin, permissions) — fall back.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading digest">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

export function DigestView({ communityId: requestedCommunity }: { communityId?: string } = {}) {
  const reduce = useReducedMotion();
  const [communityId, setCommunityId] = useState(requestedCommunity ?? DEFAULT_COMMUNITY);
  const { digest, status, refreshing, refresh } = useDigest(communityId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Allow /digest?communityId=… without needing useSearchParams (keeps the page statically renderable).
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('communityId');
    if (fromQuery) setCommunityId(fromQuery);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((next: NonNullable<Toast>) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const markdown = useMemo(() => (digest ? digestToDiscordMarkdown(digest) : ''), [digest]);
  const now = useMemo(() => (digest ? new Date(digest.generatedAt) : new Date()), [digest]);
  const simulated = communityId === DEMO_COMMUNITY;

  const onCopy = useCallback(async () => {
    const ok = await copyText(markdown);
    showToast(
      ok
        ? { kind: 'success', text: 'Digest copied as Discord markdown.' }
        : { kind: 'error', text: 'Could not copy — select the text in the post preview instead.' },
    );
  }, [markdown, showToast]);

  const onConfirmPost = useCallback(async () => {
    if (!digest) return;
    setPosting(true);
    try {
      const result = await postDigest({
        communityId,
        content: markdown,
        generatedAt: digest.generatedAt,
        actor: 'reviewer',
      });
      setDialogOpen(false);
      showToast({
        kind: 'success',
        text: result.simulated ? 'Demo mode — digest post simulated, nothing sent.' : 'Digest posted to Discord.',
      });
    } catch (err) {
      if (err instanceof DigestChangedError) {
        // Nothing was posted. Reload so the dialog shows the new text and the reviewer approves again.
        await refresh();
        showToast({ kind: 'error', text: 'The digest changed while you were reviewing. Check the updated preview, then post.' });
      } else {
        showToast({ kind: 'error', text: err instanceof Error ? err.message : 'Could not post the digest.' });
      }
    } finally {
      setPosting(false);
    }
  }, [communityId, digest, markdown, refresh, showToast]);

  const empty =
    digest &&
    digest.open.length + digest.overdue.length + digest.unansweredQuestions.length + digest.decisions.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-semibold tracking-[-0.02em] text-[#E8EAF2] sm:text-4xl"
            style={{ fontFamily: 'var(--font-space-grotesk, inherit)' }}
          >
            Digest
          </h1>
          <p className="mt-1 text-sm text-[#8A90A6]">
            {digest ? <>Generated {formatGenerated(digest.generatedAt)} · </> : null}
            what is open, overdue and unanswered — at a glance.
          </p>
          {status === 'sample' ? (
            <p
              role="status"
              className="mt-2 inline-block rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1 text-xs text-[#FBBF24]"
            >
              Showing sample data — the digest API isn&rsquo;t reachable.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-[#E8EAF2] transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF] disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void onCopy()}
            disabled={!digest}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-[#E8EAF2] transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF] disabled:opacity-50"
          >
            Copy as Discord markdown
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!digest}
            className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#8F73FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF] disabled:opacity-50"
          >
            Post digest
          </button>
        </div>
      </header>

      {!digest ? (
        <Skeleton />
      ) : (
        <div className="space-y-5">
          <StatStrip stats={digest.stats} />

          {empty ? (
            <EmptyNote>Nothing open — every message is owned. Nice work.</EmptyNote>
          ) : null}

          <DigestSection
            id="digest-overdue"
            title="Overdue"
            count={digest.overdue.length}
            tone="urgent"
            hint="Past their due date"
          >
            {digest.overdue.length === 0 ? (
              <EmptyNote>Nothing overdue.</EmptyNote>
            ) : (
              <ItemList>
                {sortByUrgency(digest.overdue).map((item) => (
                  <ItemRow key={item.id} item={item} now={now} showOwner />
                ))}
              </ItemList>
            )}
          </DigestSection>

          <DigestSection
            id="digest-open"
            title="Open by owner"
            count={digest.open.length}
            tone="primary"
            hint="Most urgent first"
          >
            {digest.open.length === 0 ? (
              <EmptyNote>No open tasks or requests.</EmptyNote>
            ) : (
              <OwnerGroups items={digest.open} now={now} />
            )}
          </DigestSection>

          <div className="grid gap-5 lg:grid-cols-2">
            <DigestSection
              id="digest-questions"
              title="Unanswered questions"
              count={digest.unansweredQuestions.length}
              tone="question"
            >
              {digest.unansweredQuestions.length === 0 ? (
                <EmptyNote>Every question has an answer.</EmptyNote>
              ) : (
                <ItemList>
                  {sortByUrgency(digest.unansweredQuestions).map((item) => (
                    <ItemRow key={item.id} item={item} now={now} showReply />
                  ))}
                </ItemList>
              )}
            </DigestSection>

            <DigestSection id="digest-decisions" title="Decisions this week" count={digest.decisions.length} tone="decision">
              {digest.decisions.length === 0 ? (
                <EmptyNote>No decisions recorded this week.</EmptyNote>
              ) : (
                <ItemList>
                  {digest.decisions.map((item) => (
                    <ItemRow key={item.id} item={item} now={now} />
                  ))}
                </ItemList>
              )}
            </DigestSection>
          </div>
        </div>
      )}

      <ConfirmPostDialog
        open={dialogOpen}
        content={markdown}
        simulated={simulated}
        posting={posting}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => void onConfirmPost()}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {toast ? (
          <div
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur-xl ${
              reduce ? '' : 'animate-in fade-in slide-in-from-bottom-2'
            } ${
              toast.kind === 'success'
                ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#6EE7B7]'
                : 'border-[#F43F5E]/40 bg-[#F43F5E]/10 text-[#FDA4AF]'
            }`}
          >
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
