import type { ItemType, Priority } from "@/components/clerk/brand/types";

// Static fixture data for the landing page's looping mini-board. Deliberately
// local: the marketing page must work with no API, DB or other owner's code.

export interface HeroItem {
  id: string;
  type: ItemType;
  title: string;
  owner: string | null;
  priority: Priority;
  due: string | null;
  confidence: number;
  /** Source message in the chat strip. */
  author: string;
  text: string;
  /** Text Clerk posts back once approved. */
  postBack: string;
}

export const HERO_ITEMS: HeroItem[] = [
  {
    id: "venue",
    type: "request",
    title: "Book a venue for 60 in Shoreditch",
    owner: "Sam",
    priority: "P0",
    due: "due Fri",
    confidence: 0.94,
    author: "Priya",
    text: "we still need a space for 60 ppl in Shoreditch by Fri, anyone??",
    postBack: "✅ Sam is on the venue, due Fri",
  },
  {
    id: "pizza",
    type: "task",
    title: "Order pizza for Thursday",
    owner: "Ana",
    priority: "P1",
    due: "due Thu",
    confidence: 0.91,
    author: "Ana",
    text: "I'll grab the pizza Thursday, leave it with me 🍕",
    postBack: "✅ Ana is on pizza, due Thu",
  },
  {
    id: "sponsor",
    type: "request",
    title: "Reply to fintech sponsor offer (£500)",
    owner: "Jo",
    priority: "P1",
    due: "due Mon",
    confidence: 0.88,
    author: "Dev",
    text: "a fintech just offered £500 to sponsor, who's replying?",
    postBack: "✅ Jo is replying to the sponsor, due Mon",
  },
  {
    id: "date",
    type: "decision",
    title: "Meetup moves from Thursday to Wednesday",
    owner: null,
    priority: "P2",
    due: null,
    confidence: 0.86,
    author: "Sam",
    text: "right, moving it to Wednesday. final answer.",
    postBack: "📌 Decision: meetup is now on Wednesday",
  },
  {
    id: "access",
    type: "question",
    title: "Is there step-free access at the venue?",
    owner: null,
    priority: "P2",
    due: null,
    confidence: 0.83,
    author: "Luca",
    text: "is there step-free access? asking for a friend",
    postBack: "💬 Suggested reply: yes, via the side entrance",
  },
  {
    id: "hdmi",
    type: "task",
    title: "Bring an HDMI adapter",
    owner: null,
    priority: "P3",
    due: "due Wed",
    confidence: 0.72,
    author: "Maya",
    text: "can someone bring an HDMI thing? my laptop is usb-c only",
    postBack: "✅ Someone is on HDMI, due Wed",
  },
];

/** Chatter Clerk ignores — shown dimmed in the chat strip. */
export const NOISE_LINES: { author: string; text: string }[] = [
  { author: "Tom", text: "lmaooo 😂😂" },
  { author: "Kit", text: "this meme though 💀" },
  { author: "Ola", text: "+1" },
  { author: "Ben", text: "gm all ☕" },
  { author: "Zara", text: "haha classic" },
  { author: "Rui", text: "👍" },
];

export const INITIALS = (name: string) => name.slice(0, 2).toUpperCase();
