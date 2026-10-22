import type { ExtractedItem, SimScriptStep } from '@clerk/core';

/**
 * Local fallback for demo/seed/london-meetup.json (owned by C8). Same shape, so
 * swapping to C8's loadScript() is a one-line change in script-source.ts.
 * Timeline: Monday 2 Nov 2026 (GMT); the meetup starts out as Thursday 5 Nov.
 */

const channelId = 'meetup-planning';
let n = 0;

function msg(
  authorName: string,
  time: string,
  content: string,
  extra: { threadId?: string; replyToExternalId?: string } = {},
): SimScriptStep['message'] {
  n += 1;
  return {
    externalId: `sim-${String(n).padStart(3, '0')}`,
    channelId,
    authorName,
    authorExternalId: authorName.toLowerCase().replace(/\W+/g, '-'),
    content,
    sentAt: `2026-11-02T${time}:00+00:00`,
    source: 'simulator',
    ...extra,
  };
}

function item(partial: Partial<ExtractedItem> & Pick<ExtractedItem, 'type' | 'title' | 'confidence'>): ExtractedItem {
  return {
    summary: '',
    owner_name: null,
    priority: 'P2',
    due_at: null,
    suggested_reply: null,
    event: null,
    reasoning: '',
    ...partial,
  };
}

const noise = (reasoning: string): ExtractedItem[] => [
  item({ type: 'noise', title: 'Chatter', confidence: 0.95, reasoning }),
];

const venue = msg('Sam Okafor', '09:02', 'Right, pub fell through. We need a venue for 60 people in Shoreditch for Thursday and we need it ASAP');
const pizza = msg('Ana Ribeiro', '09:04', "I'll grab the pizza for Thursday, sorting it by 5pm that day");
const access = msg('Tom Hargreaves', '09:08', 'is there step-free access at wherever we end up? asking for a friend');
const dateChange = msg('Sam Okafor', '09:16', "Actually shall we move it Thursday → Wednesday? Wed the 4th suits the venues I'm looking at");

export const FIXTURE_SCRIPT: SimScriptStep[] = [
  {
    delayMs: 1500,
    message: msg('Priya Nair', '09:00', 'morning all ☕'),
    cachedItems: noise('Greeting, nothing actionable.'),
  },
  {
    delayMs: 2200,
    message: venue,
    cachedItems: [
      item({
        type: 'request',
        title: 'Find Shoreditch venue for 60 people',
        summary: 'Pub fell through; venue needed for Thursday meetup, 60 attendees.',
        priority: 'P0',
        due_at: '2026-11-03T18:00:00+00:00',
        confidence: 0.94,
        reasoning: 'Explicit need, capacity, location and urgency.',
      }),
    ],
  },
  {
    delayMs: 1800,
    message: msg('Priya Nair', '09:03', 'third time this month 😭😭'),
    cachedItems: noise('Reaction, no request.'),
  },
  {
    delayMs: 2400,
    message: pizza,
    cachedItems: [
      item({
        type: 'task',
        title: 'Order pizza for Thursday',
        summary: 'Ana is ordering pizza, to be sorted by 5pm on the day.',
        owner_name: 'Ana Ribeiro',
        priority: 'P1',
        due_at: '2026-11-05T17:00:00+00:00',
        confidence: 0.96,
        reasoning: 'Volunteer names themselves and gives a time.',
      }),
    ],
  },
  {
    delayMs: 2600,
    message: access,
    cachedItems: [
      item({
        type: 'question',
        title: 'Is the venue step-free?',
        summary: 'Tom asks whether the venue has step-free access.',
        priority: 'P1',
        confidence: 0.89,
        suggested_reply: "Great question, Tom. We'll confirm step-free access as soon as the venue is locked in and post it here.",
        reasoning: 'Direct question about accessibility.',
      }),
    ],
  },
  {
    delayMs: 1500,
    message: msg('Liam Doyle', '09:10', '[gif: this is fine, dog in burning room]'),
    cachedItems: noise('Meme.'),
  },
  {
    delayMs: 3000,
    message: msg(
      'Dami Adeyemi',
      '09:12',
      "Hi all, Dami from Kestrel Pay here. We'd love to sponsor the meetup, can do £500 plus swag. Who should I talk to?",
    ),
    cachedItems: [
      item({
        type: 'request',
        title: 'Reply to Kestrel Pay £500 sponsorship offer',
        summary: 'Fintech offers £500 plus swag and asks for a point of contact.',
        priority: 'P1',
        confidence: 0.92,
        reasoning: 'Sponsor lead awaiting a contact; revenue opportunity.',
      }),
    ],
  },
  {
    delayMs: 2800,
    message: dateChange,
    cachedItems: [
      item({
        type: 'decision',
        title: 'Move meetup from Thursday to Wednesday 4 Nov',
        summary: 'Sam proposes Wednesday to fit venue availability.',
        owner_name: 'Sam Okafor',
        priority: 'P0',
        due_at: '2026-11-04T18:00:00+00:00',
        confidence: 0.84,
        reasoning: 'Proposed change of date; needs confirmation.',
      }),
    ],
  },
  {
    delayMs: 2200,
    message: msg('Ana Ribeiro', '09:18', "Wed's fine, I'll move the pizza order to Wednesday then", {
      threadId: 'date-change',
      replyToExternalId: dateChange.externalId,
    }),
    cachedItems: [
      item({
        type: 'task',
        title: 'Move pizza order to Wednesday',
        summary: 'Ana will shift the pizza order to match the new date.',
        owner_name: 'Ana Ribeiro',
        priority: 'P1',
        due_at: '2026-11-04T17:00:00+00:00',
        confidence: 0.9,
        reasoning: 'Follow-up from the pizza volunteer after the date change.',
      }),
    ],
  },
  {
    delayMs: 1900,
    message: msg('Tom Hargreaves', '09:20', 'lol 😂😂😂'),
    cachedItems: noise('Reaction.'),
  },
  {
    delayMs: 2600,
    message: msg('Priya Nair', '09:22', "can someone bring a HDMI cable? the projector's always dodgy"),
    cachedItems: [
      item({
        type: 'task',
        title: 'Bring HDMI cable for the projector',
        summary: 'Nobody has volunteered yet.',
        priority: 'P2',
        confidence: 0.78,
        reasoning: 'Request for a volunteer; no owner named.',
      }),
    ],
  },
  {
    delayMs: 2400,
    message: msg('Sam Okafor', '09:25', "will confirm step-free once the venue's locked in @Tom", {
      replyToExternalId: access.externalId,
    }),
    cachedItems: [
      item({
        type: 'task',
        title: 'Confirm step-free access at venue',
        summary: 'Sam will confirm accessibility once the venue is booked.',
        owner_name: 'Sam Okafor',
        priority: 'P1',
        confidence: 0.86,
        reasoning: 'Sam commits to confirm; replies to the access question.',
      }),
    ],
  },
  {
    delayMs: 2500,
    message: msg('Chidi Eze', '09:27', "I can do the registration desk Wednesday, doors at 6 yeah?"),
    cachedItems: [
      item({
        type: 'task',
        title: 'Run registration desk on Wednesday',
        summary: 'Chidi volunteers for registration, doors at 6pm.',
        owner_name: 'Chidi Eze',
        priority: 'P2',
        due_at: '2026-11-04T18:00:00+00:00',
        confidence: 0.9,
        reasoning: 'Volunteer names themselves for a clear task.',
      }),
    ],
  },
  {
    delayMs: 2000,
    message: msg('Liam Doyle', '09:29', "someone should sort the mic"),
    cachedItems: [
      item({
        type: 'task',
        title: 'Sort the microphone',
        summary: 'Unclear who is responsible or what is needed.',
        priority: 'P2',
        confidence: 0.42,
        reasoning: 'No owner, no deadline, vague scope.',
      }),
    ],
  },
  {
    delayMs: 3000,
    message: msg('Dami Adeyemi', '09:31', 'Lightning talks dry run Tuesday 7pm at Hackney Works, anyone free to join?'),
    cachedItems: [
      item({
        type: 'event',
        title: 'Lightning talks dry run',
        summary: 'Dry run for the lightning talks at Hackney Works.',
        priority: 'P2',
        due_at: '2026-11-03T19:00:00+00:00',
        confidence: 0.88,
        event: { start: '2026-11-03T19:00:00+00:00', end: '2026-11-03T20:30:00+00:00', location: 'Hackney Works' },
        reasoning: 'Specific time and place.',
      }),
    ],
  },
  {
    delayMs: 1800,
    message: msg('Liam Doyle', '09:33', 'RSVPs at 47 btw 🎉'),
    cachedItems: noise('Status update, no action.'),
  },
  {
    delayMs: 2600,
    message: msg('Priya Nair', '09:35', 'also is there parking nearby or is it all bikes and buses'),
    cachedItems: [
      item({
        type: 'question',
        title: 'Is there parking near the venue?',
        summary: 'Priya asks about parking.',
        priority: 'P3',
        confidence: 0.81,
        suggested_reply: "Venue isn't confirmed yet. We'll share transport and parking details once it is.",
        reasoning: 'Direct question about logistics.',
      }),
    ],
  },
];
