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
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]';

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
    <section aria-label="Messages Clerk couldn’t handle" className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by reason">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All <Count n={sorted.length} />
          </FilterChip>
          {REASON_ORDER.filter((r) => counts[r]).map((r) => (
            <FilterChip key={r} active={filter === r} colour={REASON_META[r].colour} onClick={() => setFilter(r)}>
              {REASON_META[r].label} <Count n={counts[r] ?? 0} />
            </FilterChip>
          ))}
          <FilterChip active={unclaimedOnly} onClick={() => setUnclaimedOnly((v) => !v)}>
            Unclaimed only
          </FilterChip>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#8A90A6]">
            Claiming as
            <input
              value={actor}
              onChange={(e) => updateActor(e.target.value)}
              placeholder="Organiser"
              maxLength={40}
              className={`w-28 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-[#E8EAF2] placeholder:text-[#8A90A6]/70 ${FOCUS_RING}`}
            />
          </label>
          <SourceBadge source={feed.source} pulseKey={feed.failures.length} reduceMotion={!!reduceMotion} />
        </div>
      </div>

      <p className="text-sm text-[#8A90A6]" aria-live="off">
        <span className="font-mono tabular-nums text-[#E8EAF2]">{unclaimedCount}</span> waiting for a human ·{' '}
        <span className="font-mono tabular-nums text-[#E8EAF2]">{sorted.length - unclaimedCount}</span> claimed
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-4 py-3 text-sm text-[#E8EAF2]"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className={`shrink-0 rounded text-[#8A90A6] hover:text-white ${FOCUS_RING}`}>
            Dismiss
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#141826]/60 backdrop-blur-[16px]"
        role="region"
        aria-label="Couldn’t-handle log table"
        tabIndex={0}
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-[#8A90A6]">
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
                      backgroundColor: fresh.has(f.id) ? ['#22D3EE26', '#22D3EE00'] : '#22D3EE00',
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, backgroundColor: { duration: 1.6 } }}
                    className="border-b border-white/[0.06] last:border-b-0"
                  >
                    <tr className="align-top">
                      <td className={`max-w-[26rem] px-4 py-3 ${owner ? 'opacity-55' : ''}`}>
                        <div className="mb-0.5 text-xs font-medium text-[#8A90A6]">{f.authorName ?? 'Unknown author'}</div>
                        <p className="line-clamp-2 text-[#E8EAF2]">{f.messageContent ?? 'Message text not available.'}</p>
                        <button
                          onClick={() => toggle(f.id)}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          className={`mt-1 rounded text-xs text-[#22D3EE] hover:underline ${FOCUS_RING}`}
                        >
                          {isOpen ? 'Hide details' : 'Why?'}
                        </button>
                      </td>
                      <td className={`px-4 py-3 ${owner ? 'opacity-55' : ''}`}><ReasonBadge reason={f.reason} /></td>
                      <td className={`px-4 py-3 ${owner ? 'opacity-55' : ''}`}><ConfidenceMeter confidence={f.confidence} /></td>
                      <td className={`whitespace-nowrap px-4 py-3 text-[#8A90A6] ${owner ? 'opacity-55' : ''}`}>
                        <time dateTime={f.createdAt} title={londonTimestamp(f.createdAt)} suppressHydrationWarning>
                          {now === null ? londonTimestamp(f.createdAt) : relativeTime(f.createdAt, now)}
                        </time>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {owner ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-[#34D399]">
                            <span aria-hidden>✓</span> Claimed by {owner}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaim(f)}
                            disabled={claiming.has(f.id)}
                            className={`rounded-lg bg-[#7C5CFF] px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#6B4CEB] disabled:opacity-60 ${FOCUS_RING}`}
                          >
                            Claim
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={detailId}>
                        <td colSpan={5} className="px-4 pb-4">
                          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                            <p className="text-[#E8EAF2]">{REASON_META[f.reason].hint}</p>
                            <p className="font-mono text-xs text-[#8A90A6]">
                              Raw model output
                            </p>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[#8A90A6]">
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

      {feed.error && <p role="alert" className="text-sm text-[#F43F5E]">Live updates paused: {feed.error}</p>}
    </section>
  );
}

function FilterChip(props: { active: boolean; colour?: string; onClick: () => void; children: React.ReactNode }) {
  const { active, colour = '#7C5CFF', onClick, children } = props;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${FOCUS_RING} ${
        active ? 'text-white' : 'border-white/[0.08] text-[#8A90A6] hover:text-[#E8EAF2]'
      }`}
      style={active ? { backgroundColor: `${colour}33`, borderColor: `${colour}80` } : undefined}
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
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-[#8A90A6]"
      title={live ? 'Updating in realtime' : 'Showing sample data — not connected to a live community'}
    >
      <motion.span
        key={pulseKey}
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: live ? '#22D3EE' : '#4B5163' }}
        animate={live && !reduceMotion ? { scale: [1, 1.8, 1], opacity: [1, 0.6, 1] } : undefined}
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
        <tr key={i} className="border-b border-white/[0.06]">
          <td colSpan={5} className="px-4 py-4">
            <div className="h-9 rounded-lg bg-white/[0.05] motion-safe:animate-pulse" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-medium text-[#E8EAF2]">
        {filtered ? 'Nothing matches those filters.' : 'Nothing has slipped through. Yet.'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#8A90A6]">
        {filtered
          ? 'Clear a filter to see everything Clerk has set aside.'
          : 'When Clerk isn’t sure about a message, it will appear here rather than guess.'}
      </p>
    </div>
  );
}
