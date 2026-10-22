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
          <div key={i} className="h-[76px] animate-pulse rounded-xl bg-sunken" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-sunken" />
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
    <div className="mx-auto w-full max-w-[760px] px-4 py-14 sm:px-8">
      <header className="mb-10 flex flex-col gap-6">
        <div>
          <p className="eyebrow">{digest ? <>Generated {formatGenerated(digest.generatedAt)}</> : 'Weekly summary'}</p>
          <h1 className="mt-2.5 text-4xl font-semibold leading-[1.15] tracking-[-0.025em]">Digest</h1>
          <p className="mt-3 text-muted-foreground">
            What is open, overdue and unanswered in your community, at a glance.
          </p>
          {status === 'error' ? (
            <p role="alert" className="mt-3 text-[13px] text-urgent">
              Could not load the live digest. Check your connection and press Refresh.
            </p>
          ) : null}
          {status === 'sample' ? (
            <p
              role="status"
              className="mt-3 text-[13px] text-warning"
            >
              Showing sample data — the digest API isn&rsquo;t reachable.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!digest}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-[18px] text-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Post to Discord…
          </button>
          <button
            type="button"
            onClick={() => void onCopy()}
            disabled={!digest}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-input bg-surface px-4 text-sm text-foreground transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Copy as Markdown
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm text-muted-foreground transition-colors hover:bg-sunken hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {!digest ? (
        status === 'error' ? <EmptyNote>Live community data is unavailable.</EmptyNote> : <Skeleton />
      ) : (
        <div className="space-y-12">
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

          <div className="space-y-12">
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
            className={`pointer-events-auto rounded-xl border bg-surface px-4 py-2.5 text-sm shadow-pop ${
              reduce ? '' : 'animate-in fade-in slide-in-from-bottom-2'
            } ${
              toast.kind === 'success'
                ? 'border-success/40 text-success'
                : 'border-urgent/40 text-urgent'
            }`}
          >
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
