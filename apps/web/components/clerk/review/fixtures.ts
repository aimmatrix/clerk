import type { Item } from "@clerk/core";
import type { SourceContext, SourceMessage } from "./types";

const COMMUNITY = "00000000-0000-0000-0000-000000000001";

const hoursFrom = (now: Date, h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

function msg(now: Date, id: string, author: string, content: string, minsAgo: number, isTarget = false): SourceMessage {
  return { externalId: id, authorName: author, content, sentAt: new Date(now.getTime() - minsAgo * 60_000).toISOString(), isTarget };
}

/** Mock review queue for the C4 flow when the API is not available (NEXT_PUBLIC_REVIEW_MOCK=1). */
export function makeFixtures(now: Date = new Date()): { items: Item[]; contexts: Record<string, SourceContext> } {
  const base = {
    communityId: COMMUNITY,
    status: "pending" as const,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    createdAt: new Date(now.getTime() - 4 * 60_000).toISOString(),
    updatedAt: new Date(now.getTime() - 4 * 60_000).toISOString(),
  };

  const items: Item[] = [
    {
      ...base,
      id: "item-venue",
      messageId: "msg-venue",
      type: "request",
      title: "Find a Shoreditch venue for 60 people",
      summary: "Priya needs a venue for the 60-person meetup. The current space only holds 40.",
      ownerName: null,
      priority: "P0",
      dueAt: hoursFrom(now, 20),
      confidence: 0.93,
      urgencyScore: 96,
      suggestedReply: null,
      sourceLink: "https://example.test/chat/msg-venue",
    },
    {
      ...base,
      id: "item-pizza",
      messageId: "msg-pizza",
      type: "task",
      title: "Order pizza for the meetup",
      summary: "Ana volunteered to sort food. Needs ordering by Thursday.",
      ownerName: "Ana",
      priority: "P1",
      dueAt: hoursFrom(now, 52),
      confidence: 0.91,
      urgencyScore: 74,
      suggestedReply: null,
      sourceLink: "https://example.test/chat/msg-pizza",
    },
    {
      ...base,
      id: "item-sponsor",
      messageId: "msg-sponsor",
      type: "request",
      title: "Reply to fintech sponsor offer (£500)",
      summary: "A fintech wants to sponsor the night for £500 and asked who to speak to.",
      ownerName: null,
      priority: "P1",
      dueAt: hoursFrom(now, 72),
      confidence: 0.84,
      urgencyScore: 66,
      suggestedReply: null,
      sourceLink: "https://example.test/chat/msg-sponsor",
    },
    {
      ...base,
      id: "item-date",
      messageId: "msg-date",
      type: "decision",
      title: "Move the meetup from Thursday to Wednesday",
      summary: "Venue is only free on Wednesday, so the date moves. Two people agreed in the thread.",
      ownerName: null,
      priority: "P1",
      dueAt: null,
      confidence: 0.88,
      urgencyScore: 58,
      suggestedReply: null,
      sourceLink: "https://example.test/chat/msg-date",
    },
    {
      ...base,
      id: "item-access",
      messageId: "msg-access",
      type: "question",
      title: "Answer: is there step-free access?",
      summary: "A member asked whether the venue has step-free access.",
      ownerName: null,
      priority: "P2",
      dueAt: null,
      confidence: 0.79,
      urgencyScore: 41,
      suggestedReply: "Yes — the main entrance is step-free and there's a lift to the first floor. Shout if you need anything else.",
      sourceLink: "https://example.test/chat/msg-access",
    },
    {
      ...base,
      id: "item-hdmi",
      messageId: "msg-hdmi",
      type: "task",
      title: "Bring an HDMI cable and adaptor",
      summary: "Someone needs to bring HDMI for the projector. Nobody has claimed it.",
      ownerName: null,
      priority: "P2",
      dueAt: hoursFrom(now, 96),
      confidence: 0.72,
      urgencyScore: 33,
      suggestedReply: null,
      sourceLink: "https://example.test/chat/msg-hdmi",
    },
    {
      ...base,
      id: "item-talk",
      messageId: "msg-talk",
      type: "event",
      title: "Lightning talks, 19:30 start",
      summary: "Lightning talks kick off at 19:30 once everyone has eaten.",
      ownerName: null,
      priority: "P3",
      dueAt: null,
      confidence: 0.81,
      urgencyScore: 22,
      suggestedReply: null,
      eventStart: hoursFrom(now, 76),
      eventEnd: hoursFrom(now, 78),
      eventLocation: "Shoreditch, London",
      sourceLink: "https://example.test/chat/msg-talk",
    },
  ];

  const contexts: Record<string, SourceContext> = {
    "msg-venue": {
      message: msg(now, "msg-venue", "Priya", "ok so we're at 60 RSVPs now 😅 the Old St space only fits 40, can someone find a bigger venue ASAP?", 4, true),
      context: [
        msg(now, "c1", "Sam", "RSVPs are flying in tbh", 9),
        msg(now, "c2", "Priya", "just hit 52 on the form", 7),
      ],
    },
    "msg-pizza": {
      message: msg(now, "msg-pizza", "Ana", "i'll grab the pizza, will order Thurs morning", 12, true),
      context: [msg(now, "c3", "Sam", "we need food sorted for 60ish", 14)],
    },
    "msg-sponsor": {
      message: msg(now, "msg-sponsor", "Jo (Ledgr)", "hey! we'd love to sponsor the night — £500 ok? who should I speak to about logistics?", 20, true),
      context: [],
    },
    "msg-date": {
      message: msg(now, "msg-date", "Sam", "venue's only free Weds so let's move it from Thurs to Weds, shout if that breaks anything", 30, true),
      context: [
        msg(now, "c4", "Priya", "Thurs is booked out there sadly", 33),
        msg(now, "c5", "Ana", "weds works for me", 28),
      ],
    },
    "msg-access": {
      message: msg(now, "msg-access", "Dev", "is there step-free access at the venue?", 45, true),
      context: [],
    },
    "msg-hdmi": {
      message: msg(now, "msg-hdmi", "Sam", "can someone bring HDMI for the projector?", 50, true),
      context: [msg(now, "c6", "Priya", "projector's there but no cables I think", 52)],
    },
    "msg-talk": {
      message: msg(now, "msg-talk", "Priya", "lightning talks at 7:30 once everyone's eaten", 55, true),
      context: [],
    },
  };

  return { items, contexts };
}
