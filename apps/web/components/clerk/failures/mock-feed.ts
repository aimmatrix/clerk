import type { Failure } from './types';

const minutesAgo = (now: number, m: number) => new Date(now - m * 60_000).toISOString();

/** Fixture rows covering every reason, a null confidence, and one already-claimed row. */
export function buildMockFailures(communityId: string, now = Date.now()): Failure[] {
  const base = { communityId, claimedBy: null };
  return [
    {
      ...base,
      id: 'f-001',
      messageId: 'm-001',
      reason: 'ambiguous_owner',
      confidence: 0.71,
      raw: {
        items: [{ type: 'task', title: 'Sort the mic for Thursday', owner_name: null, confidence: 0.71 }],
        reasoning: 'Task is clear but nobody is named.',
      },
      createdAt: minutesAgo(now, 2),
      authorName: 'Tom',
      messageContent: 'someone should really sort the mic before thursday, last time it cut out halfway through',
    },
    {
      ...base,
      id: 'f-002',
      messageId: 'm-002',
      reason: 'low_confidence',
      confidence: 0.38,
      raw: { items: [{ type: 'request', title: 'Do the thing from last time', confidence: 0.38 }] },
      createdAt: minutesAgo(now, 9),
      authorName: 'Priya',
      messageContent: 'lol same 😂 but can we do the thing from last time? you know the one',
    },
    {
      ...base,
      id: 'f-003',
      messageId: 'm-003',
      reason: 'unsupported',
      confidence: null,
      raw: { detail: 'Message language not supported (es).' },
      createdAt: minutesAgo(now, 24),
      authorName: 'Marta',
      messageContent: '¿Podemos mover la reunión al miércoles? Yo puedo ayudar con el registro.',
    },
    {
      ...base,
      id: 'f-004',
      messageId: 'm-004',
      reason: 'llm_error',
      confidence: null,
      raw: { error: 'Request timed out after 15000ms', attempts: 2 },
      createdAt: minutesAgo(now, 41),
      authorName: 'Sam',
      messageContent:
        'Hackney Co-Work have confirmed the room for 60, but we need to give them a final headcount by Friday 5pm.',
    },
    {
      ...base,
      id: 'f-005',
      messageId: 'm-005',
      reason: 'invalid_json',
      confidence: null,
      raw: '{"items":[{"type":"task","title":"Book a sign language interpreter","owner_name":"Ana","priority":',
      createdAt: minutesAgo(now, 66),
      authorName: 'Ana',
      messageContent: 'Can we get a BSL interpreter for the keynote? I’ll ask around but no promises',
    },
    {
      ...base,
      id: 'f-006',
      messageId: 'm-006',
      reason: 'low_confidence',
      confidence: 0.52,
      raw: { items: [{ type: 'task', title: 'Help with registration', owner_name: 'Jo', confidence: 0.52 }] },
      createdAt: minutesAgo(now, 95),
      authorName: 'Jo',
      messageContent: 'might be able to help on the door, depends on work tbh',
    },
    {
      ...base,
      id: 'f-007',
      messageId: 'm-007',
      reason: 'ambiguous_owner',
      confidence: 0.66,
      raw: { items: [{ type: 'task', title: 'Bring HDMI cable', owner_name: null, confidence: 0.66 }] },
      createdAt: minutesAgo(now, 130),
      authorName: 'Dev',
      messageContent: 'can he bring the HDMI cable? the venue one is dead',
    },
    {
      ...base,
      id: 'f-008',
      messageId: 'm-008',
      reason: 'low_confidence',
      confidence: 0.44,
      raw: { items: [{ type: 'event', title: 'Afterparty?', confidence: 0.44 }] },
      createdAt: minutesAgo(now, 190),
      authorName: 'Leila',
      claimedBy: 'Sam',
      messageContent: 'pub after maybe?? depends how long the talks run',
    },
  ];
}

/** A fresh failure used to show the realtime insert animation in mock mode. */
export function buildIncomingMockFailure(communityId: string, now = Date.now()): Failure {
  return {
    id: `f-live-${now}`,
    communityId,
    messageId: `m-live-${now}`,
    reason: 'low_confidence',
    confidence: 0.47,
    raw: { items: [{ type: 'request', title: 'Sort out the stuff', confidence: 0.47 }] },
    claimedBy: null,
    createdAt: new Date(now).toISOString(),
    authorName: 'Chidi',
    messageContent: 'can someone sort out the stuff for the thing',
  };
}
