'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { claimFailure } from './api-client';
import { ConfidenceMeter } from './confidence-meter';
import { ReasonBadge } from './reason-badge';
import { REASON_META, REASON_ORDER } from './reason-meta';
import { londonTimestamp, relativeTime } from './time';
import type { Failure, FailureReason } from './types';
import { useFailureFeed } from './use-failure-feed';

const ACTOR_KEY = 'clerk:actor';
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

type ReasonFilter = FailureReason | 'all';

export function FailuresLog({ communityId }: { communityId: string }) {
  const reduceMotion = useReducedMotion();
  const feed = useFailureFeed(communityId);

  const [filter, setFilter] = useState<ReasonFilter>('all');
  const [unclaimedOnly, setUnclaimedOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actor, setActor] = useState('');
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [claiming, setClaiming] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number | null>(null);

  // Remember who is claiming; storage can be blocked, so never let it break the page.
  useEffect(() => {
    try {
      setActor(window.localStorage.getItem(ACTOR_KEY) ?? '');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const updateActor = (value: string) => {
    setActor(value);
    try {
      window.localStorage.setItem(ACTOR_KEY, value);
    } catch {
      /* storage unavailable */
    }
  };

  // Relative times are filled in after mount so server and client markup match.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Flag rows that arrive after the first load so they can flash as "new".
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (feed.loading) return;
    if (seen.current === null) {
      seen.current = new Set(feed.failures.map((f) => f.id));
      return;
    }
    const arrivals = feed.failures.filter((f) => !seen.current!.has(f.id));
    if (arrivals.length === 0) return;
    arrivals.forEach((f) => seen.current!.add(f.id));
    setFresh((current) => new Set([...current, ...arrivals.map((f) => f.id)]));
    setAnnouncement(`${arrivals.length} new message Clerk couldn’t handle.`);
  }, [feed.failures, feed.loading]);

  const claimedBy = useCallback((f: Failure) => f.claimedBy ?? claims[f.id] ?? null, [claims]);

  const sorted = useMemo(
    () => [...feed.failures].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [feed.failures],
  );
  const counts = useMemo(() => {
    const byReason: Partial<Record<FailureReason, number>> = {};
    for (const f of sorted) byReason[f.reason] = (byReason[f.reason] ?? 0) + 1;
    return byReason;
  }, [sorted]);
  const unclaimedCount = sorted.filter((f) => !claimedBy(f)).length;
  const visible = sorted.filter(
    (f) => (filter === 'all' || f.reason === filter) && (!unclaimedOnly || !claimedBy(f)),
  );

  async function handleClaim(failure: Failure) {
    const name = actor.trim() || 'Organiser';
    setError(null);
    setClaiming((s) => new Set(s).add(failure.id));
    setClaims((c) => ({ ...c, [failure.id]: name })); // optimistic
    try {
      const result = await claimFailure(failure.id, name, { offline: feed.source === 'mock' });
      setClaims((c) => ({ ...c, [failure.id]: result.claimedBy ?? name }));
      setAnnouncement(`Claimed. ${name} now owns this message.`);
    } catch (e) {
      setClaims(({ [failure.id]: _reverted, ...rest }) => rest);
      setError(e instanceof Error ? e.message : 'Couldn’t claim this one. Try again.');
    } finally {
      setClaiming((s) => {
        const next = new Set(s);
        next.delete(failure.id);
        return next;
      });
    }
  }

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section aria-label="Messages Clerk couldn’t handle" className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by reason">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All <Count n={sorted.length} />
          </FilterChip>
          {REASON_ORDER.filter((r) => counts[r]).map((r) => (
            <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)}>
              {REASON_META[r].label} <Count n={counts[r] ?? 0} />
            </FilterChip>
          ))}
          <FilterChip active={unclaimedOnly} onClick={() => setUnclaimedOnly((v) => !v)}>
            Unclaimed only
          </FilterChip>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Claiming as
            <input
              value={actor}
              onChange={(e) => updateActor(e.target.value)}
              placeholder="Organiser"
              maxLength={40}
              className={`w-28 rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle ${FOCUS_RING}`}
            />
          </label>
          <SourceBadge source={feed.source} pulseKey={feed.failures.length} reduceMotion={!!reduceMotion} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="off">
        <span className="font-mono tabular-nums text-foreground">{unclaimedCount}</span> waiting for a human ·{' '}
        <span className="font-mono tabular-nums text-foreground">{sorted.length - unclaimedCount}</span> claimed
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-urgent/30 bg-surface px-4 py-3 text-sm text-foreground"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className={`shrink-0 rounded text-muted-foreground hover:text-foreground ${FOCUS_RING}`}>
            Dismiss
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Table */}
      <div
        className="panel overflow-x-auto"
        role="region"
        aria-label="Couldn’t-handle log table"
        tabIndex={0}
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="meta-label border-b border-border !text-subtle">
              <th scope="col" className="px-4 py-3 font-medium">Message</th>
              <th scope="col" className="px-4 py-3 font-medium">Why Clerk stopped</th>
              <th scope="col" className="px-4 py-3 font-medium">Confidence</th>
              <th scope="col" className="px-4 py-3 font-medium">When</th>
              <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Action</span></th>
            </tr>
          </thead>

          {feed.loading ? (
            <SkeletonRows />
          ) : (
            <AnimatePresence initial={false}>
              {visible.map((f) => {
                const owner = claimedBy(f);
                const isOpen = expanded.has(f.id);
                const detailId = `failure-detail-${f.id}`;
                return (
                  <motion.tbody
                    key={f.id}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      backgroundColor: fresh.has(f.id) ? ['#F1EFEB', '#F1EFEB00'] : '#F1EFEB00',
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, backgroundColor: { duration: 1.6 } }}
                    className="border-b border-border last:border-b-0"
                  >
                    <tr className="align-top">
                      <td className={`max-w-[26rem] px-4 py-3 ${owner ? 'opacity-55' : ''}`}>
                        <div className="mb-0.5 text-xs text-subtle">{f.authorName ?? 'Unknown author'}</div>
                        <p className="line-clamp-2 text-foreground">{f.messageContent ?? 'Message text not available.'}</p>
                        <button
                          onClick={() => toggle(f.id)}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          className={`mt-1 rounded text-xs text-primary hover:underline ${FOCUS_RING}`}
                        >
                          {isOpen ? 'Hide details' : 'Why?'}
                        </button>
                      </td>
                      <td className={`px-4 py-3 ${owner ? 'opacity-55' : ''}`}><ReasonBadge reason={f.reason} /></td>
                      <td className={`px-4 py-3 ${owner ? 'opacity-55' : ''}`}><ConfidenceMeter confidence={f.confidence} /></td>
                      <td className={`whitespace-nowrap px-4 py-3 text-subtle ${owner ? 'opacity-55' : ''}`}>
                        <time dateTime={f.createdAt} title={londonTimestamp(f.createdAt)} suppressHydrationWarning>
                          {now === null ? londonTimestamp(f.createdAt) : relativeTime(f.createdAt, now)}
                        </time>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {owner ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
                            Claimed by {owner}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaim(f)}
                            disabled={claiming.has(f.id)}
                            className={`rounded-lg border border-input bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-sunken disabled:opacity-60 ${FOCUS_RING}`}
                          >
                            Claim
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={detailId}>
                        <td colSpan={5} className="px-4 pb-4">
                          <div className="space-y-2 rounded-lg bg-background p-3">
                            <p className="text-foreground">{REASON_META[f.reason].hint}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              Raw model output
                            </p>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                              {f.raw == null ? 'Nothing was captured.' : typeof f.raw === 'string' ? f.raw : JSON.stringify(f.raw, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </motion.tbody>
                );
              })}
            </AnimatePresence>
          )}
        </table>

        {!feed.loading && visible.length === 0 && <EmptyState filtered={sorted.length > 0} />}
      </div>

      {feed.error && <p role="alert" className="text-sm text-urgent">Live updates paused: {feed.error}</p>}
    </section>
  );
}

function FilterChip(props: { active: boolean; colour?: string; onClick: () => void; children: React.ReactNode }) {
  const { active, onClick, children } = props;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${FOCUS_RING} ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-mono tabular-nums opacity-70">{n}</span>;
}

function SourceBadge({ source, pulseKey, reduceMotion }: { source: 'live' | 'mock'; pulseKey: number; reduceMotion: boolean }) {
  const live = source === 'live';
  return (
    <span
      className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
      title={live ? 'Updating in realtime' : 'Showing sample data — not connected to a live community'}
    >
      <motion.span
        key={pulseKey}
        aria-hidden
        className="h-[7px] w-[7px] rounded-full"
        style={{ backgroundColor: live ? '#15803D' : '#A1A1AA' }}
        animate={live && !reduceMotion ? { opacity: [1, 0.5, 1] } : undefined}
        transition={{ duration: 0.8 }}
      />
      {live ? 'Live' : 'Sample data'}
    </span>
  );
}

function SkeletonRows() {
  return (
    <tbody aria-busy="true">
      {[0, 1, 2].map((i) => (
        <tr key={i} className="border-b border-border">
          <td colSpan={5} className="px-4 py-4">
            <div className="h-9 rounded-lg bg-sunken motion-safe:animate-pulse" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-medium text-foreground">
        {filtered ? 'Nothing matches those filters.' : 'Nothing has slipped through. Yet.'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {filtered
          ? 'Clear a filter to see everything Clerk has set aside.'
          : 'When Clerk isn’t sure about a message, it will appear here rather than guess.'}
      </p>
    </div>
  );
}
