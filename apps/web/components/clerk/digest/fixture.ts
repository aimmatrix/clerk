import type { Digest, Item } from '@clerk/core';

const COMMUNITY = '00000000-0000-0000-0000-000000000001';
const HOUR = 3_600_000;

/** Sample digest for offline / demo mode. Dates are relative to `now` so overdue always reads correctly. */
export function makeFixtureDigest(now: Date = new Date()): Digest {
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();

  const base = (n: number): Pick<Item, 'communityId' | 'messageId' | 'createdAt' | 'updatedAt' | 'summary' | 'eventStart' | 'eventEnd' | 'eventLocation' | 'suggestedReply' | 'sourceLink'> => ({
    communityId: COMMUNITY,
    messageId: `fixture-msg-${n}`,
    createdAt: at(-30),
    updatedAt: at(-2),
    summary: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    suggestedReply: null,
    sourceLink: null,
  });

  const venue: Item = {
    ...base(1), id: 'fx-1', type: 'request', title: 'Find a venue for 60 people in Shoreditch',
    ownerName: 'Sam', priority: 'P0', dueAt: at(-26), confidence: 0.93, urgencyScore: 100, status: 'approved',
  };
  const av: Item = {
    ...base(2), id: 'fx-2', type: 'task', title: 'Confirm HDMI and mic kit with the venue',
    ownerName: null, priority: 'P1', dueAt: at(-5), confidence: 0.71, urgencyScore: 84, status: 'pending',
  };
  const pizza: Item = {
    ...base(3), id: 'fx-3', type: 'task', title: 'Order pizza for the meetup',
    ownerName: 'Ana', priority: 'P1', dueAt: at(40), confidence: 0.91, urgencyScore: 72, status: 'approved',
  };
  const sponsor: Item = {
    ...base(4), id: 'fx-4', type: 'request', title: 'Reply to fintech sponsor offer (£500)',
    ownerName: 'Priya', priority: 'P1', dueAt: at(60), confidence: 0.88, urgencyScore: 68, status: 'pending',
  };
  const slides: Item = {
    ...base(5), id: 'fx-5', type: 'task', title: 'Collect speaker slides',
    ownerName: 'Sam', priority: 'P2', dueAt: at(110), confidence: 0.84, urgencyScore: 41, status: 'approved',
  };
  const rsvp: Item = {
    ...base(6), id: 'fx-6', type: 'task', title: 'Share RSVP count with the venue',
    ownerName: 'Ana', priority: 'P2', dueAt: null, confidence: 0.8, urgencyScore: 34, status: 'pending',
  };
  const signage: Item = {
    ...base(7), id: 'fx-7', type: 'task', title: 'Print door signage',
    ownerName: null, priority: 'P3', dueAt: null, confidence: 0.64, urgencyScore: 14, status: 'pending',
  };
  const access: Item = {
    ...base(8), id: 'fx-8', type: 'question', title: 'Is there step-free access?',
    ownerName: null, priority: 'P1', dueAt: null, confidence: 0.9, urgencyScore: 66, status: 'pending',
    suggestedReply: 'Yes — the venue has a ground-floor entrance and a step-free lift. Details to follow once confirmed.',
  };
  const parking: Item = {
    ...base(9), id: 'fx-9', type: 'question', title: 'Where can people lock up bikes?',
    ownerName: null, priority: 'P3', dueAt: null, confidence: 0.77, urgencyScore: 22, status: 'pending',
    suggestedReply: 'There are Sheffield stands outside the main entrance.',
  };
  const dateChange: Item = {
    ...base(10), id: 'fx-10', type: 'decision', title: 'Meetup moved from Thursday to Wednesday',
    ownerName: null, priority: 'P0', dueAt: null, confidence: 0.95, urgencyScore: 60, status: 'posted',
  };
  const format: Item = {
    ...base(11), id: 'fx-11', type: 'decision', title: 'Lightning talks only — no panel',
    ownerName: null, priority: 'P2', dueAt: null, confidence: 0.86, urgencyScore: 30, status: 'posted',
  };

  const open = [venue, av, pizza, sponsor, slides, rsvp, signage];
  return {
    generatedAt: now.toISOString(),
    open,
    overdue: [venue, av],
    unansweredQuestions: [access, parking],
    decisions: [dateChange, format],
    stats: { captured: 31, pending: 5, approved: 9, failures: 3, hoursSaved: (9 * 4) / 60 },
  };
}
