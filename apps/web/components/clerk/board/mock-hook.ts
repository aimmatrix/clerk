'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item, ItemStatus } from '@clerk/core';

import type { BoardItemsResult } from './types';

/**
 * Demo data source for `<Board autoplay />` (`/board?autoplay=1`): fixture items that are promoted through the
 * columns on a timer. It needs no Supabase, so the card-moving animation can be shown, or tested, anywhere.
 */

const HOUR = 3_600_000;

function fixtures(communityId: string, base: number): Item[] {
  const at = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  const make = (n: number, partial: Partial<Item> & Pick<Item, 'type' | 'title' | 'urgencyScore' | 'status'>): Item => ({
    id: `mock-item-${n}`,
    communityId,
    messageId: `mock-msg-${n}`,
    summary: null,
    ownerName: null,
    priority: 'P2',
    dueAt: null,
    confidence: 0.9,
    suggestedReply: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: null,
    createdAt: at(-n * 600_000),
    updatedAt: at(-n * 600_000),
    ...partial,
  });

  return [
    make(1, {
      type: 'request',
      title: 'Find a Shoreditch venue for 60 people',
      summary: 'Need a space with a projector and step-free access.',
      priority: 'P0',
      dueAt: at(20 * HOUR),
      confidence: 0.93,
      urgencyScore: 96,
      status: 'pending',
      sourceLink: 'https://example.com/source/1',
    }),
    make(2, {
      type: 'task',
      title: 'Order pizza for Thursday',
      ownerName: 'Ana Costa',
      priority: 'P1',
      dueAt: at(2 * 24 * HOUR),
      confidence: 0.88,
      urgencyScore: 71,
      status: 'pending',
    }),
    make(3, {
      type: 'request',
      title: 'Reply to fintech sponsor offer (£500)',
      summary: 'Sponsor would like a logo slot and two minutes on stage.',
      priority: 'P1',
      dueAt: at(3 * 24 * HOUR),
      confidence: 0.76,
      urgencyScore: 64,
      status: 'pending',
    }),
    make(4, {
      type: 'task',
      title: 'Bring an HDMI adapter',
      priority: 'P2',
      confidence: 0.67,
      urgencyScore: 38,
      status: 'pending',
    }),
    make(5, {
      type: 'question',
      title: 'Is the venue step-free?',
      suggestedReply: 'Yes, there is a level entrance and a lift to the first floor.',
      priority: 'P1',
      confidence: 0.91,
      urgencyScore: 58,
      status: 'approved',
    }),
    make(6, {
      type: 'event',
      title: 'Builders meetup',
      ownerName: 'Sam Okafor',
      priority: 'P2',
      dueAt: at(5 * 24 * HOUR),
      confidence: 0.95,
      urgencyScore: 52,
      status: 'approved',
      eventStart: at(5 * 24 * HOUR),
      eventEnd: at(5 * 24 * HOUR + 3 * HOUR),
      eventLocation: 'Shoreditch',
    }),
    make(7, {
      type: 'decision',
      title: 'Meetup moved from Thursday to Wednesday',
      priority: 'P1',
      confidence: 0.9,
      urgencyScore: 66,
      status: 'posted',
    }),
    make(8, {
      type: 'task',
      title: 'Print name badges',
      ownerName: 'Priya Nair',
      priority: 'P3',
      dueAt: at(-6 * HOUR),
      confidence: 0.82,
      urgencyScore: 44,
      status: 'posted',
    }),
    make(9, {
      type: 'task',
      title: 'Book the lightning-talk slots',
      ownerName: 'Jamie Rowe',
      priority: 'P2',
      confidence: 0.85,
      urgencyScore: 30,
      status: 'done',
    }),
    make(10, {
      type: 'question',
      title: 'Will the talks be recorded?',
      priority: 'P2',
      confidence: 0.72,
      urgencyScore: 34,
      status: 'done',
    }),
  ];
}

const NEXT_STATUS: Partial<Record<ItemStatus, ItemStatus>> = {
  pending: 'approved',
  approved: 'posted',
  posted: 'done',
};

/** Order in which autoplay promotes cards, chosen so every column sees movement. */
const AUTOPLAY_ORDER = ['mock-item-1', 'mock-item-2', 'mock-item-5', 'mock-item-3', 'mock-item-7', 'mock-item-1', 'mock-item-4'];

export function useMockItems(communityId: string, options: { autoplay?: boolean; intervalMs?: number } = {}): BoardItemsResult & {
  advance: (id: string) => void;
  reset: () => void;
} {
  const { autoplay = false, intervalMs = 2600 } = options;
  const [base] = useState(() => Date.now());
  const initial = useMemo(() => fixtures(communityId, base), [communityId, base]);
  const [items, setItems] = useState<Item[]>(initial);
  const [step, setStep] = useState(0);

  const advance = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) => {
        const next = NEXT_STATUS[item.status];
        return item.id === id && next ? { ...item, status: next, updatedAt: new Date().toISOString() } : item;
      }),
    );
  }, []);

  const reset = useCallback(() => {
    setItems(initial);
    setStep(0);
  }, [initial]);

  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = setInterval(() => {
      setStep((s) => s + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoplay, intervalMs]);

  useEffect(() => {
    if (!autoplay || step === 0) return;
    const index = (step - 1) % AUTOPLAY_ORDER.length;
    if (index === 0 && step > 1) {
      setItems(initial);
      return;
    }
    advance(AUTOPLAY_ORDER[index]);
  }, [step, autoplay, advance, initial]);

  return { items, loading: false, error: null, advance, reset };
}
