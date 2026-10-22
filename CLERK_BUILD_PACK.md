# Clerk — Build Pack
Grok Bot Community Engineering London Hackathon · Track 5 "Front Desk & Revenue" · Code freeze **21:50 BST**

---

## 1. Design direction

**Concept: "Mission control for your community inbox."** Messy chat on the left, calm, ranked order on the right. Every message visibly *becomes* something: a card flies out of chat and lands in a column.

**Palette (dark-first glassmorphism)**
| Token | Hex | Use |
|---|---|---|
| bg | `#0B0D14` | page |
| surface | `#141826` @ 60% + backdrop-blur 16px | glass panels |
| border | `#FFFFFF14` | 1px glass edges |
| text | `#E8EAF2` / muted `#8A90A6` | |
| primary (Clerk violet) | `#7C5CFF` | CTAs, focus |
| accent cyan | `#22D3EE` | live/realtime pulses |
| request | `#F59E0B` | type chip |
| task | `#7C5CFF` | |
| event | `#22D3EE` | |
| question | `#60A5FA` | |
| decision | `#34D399` | |
| noise | `#4B5163` | |
| urgent | `#F43F5E` | P0 / overdue |
| success glow | `#34D399` | approve burst |

Gradient hero: `radial-gradient(at 20% 10%, #7C5CFF33, transparent 50%), radial-gradient(at 80% 0%, #22D3EE22, transparent 40%)`.

**Typography:** Inter (UI, 14/20 base, tabular-nums for counters), Space Grotesk 600 for headings/hero (56–72px, tracking -0.02em), JetBrains Mono for IDs/confidence.

**Motion principles (Framer Motion)**
- *Fly-in:* new item spawns at its source message in chat pane (shared `layoutId=msg-<id>`) and springs to its column (`stiffness 260, damping 24`). Under 600ms.
- *Confidence ring:* SVG circle around avatar animates 0→confidence; colour green ≥0.8, amber 0.6–0.8, red <0.6 (→ failure log).
- *Approve:* card scales 1.04, emerald glow box-shadow, 12-particle burst, then slides to "Posted" column. Reject: fade + 8px drop.
- *Live counters:* stats bar numbers roll (spring on motion value): items captured, awaiting review, hours saved (= approved × 4 min ÷ 60), couldn't-handle.
- *Realtime pulse:* cyan dot pulses on "Live" badge on every insert.
- Respect `prefers-reduced-motion` (no fly, only fade).

**Key screens**
1. **Landing hero** — "Every message. Owned." subline "Clerk turns your community chat into tasks with owners, priorities and deadlines — and tells you what it couldn't handle." Live mini-board looping behind glass. CTAs: "Watch demo" (→ /simulator), "Add to Discord", GitHub star.
2. **Live board** `/board` — Kanban: Inbox (needs review) · Approved · Posted · Done; filter chips by type; cards sorted by urgency score.
3. **Review queue** `/review` — one card at a time or list; keyboard: A approve, E edit, R reassign, X reject, J/K next. Shows source message + thread context snippet + suggested reply (questions).
4. **Couldn't-handle log** `/failures` — honest table: message, reason, confidence, "claim manually" button. Framed as a feature.
5. **Digest** `/digest` — open tasks by owner, overdue (red), unanswered questions, decisions this week; "Post to Discord" (approval-gated).
6. **Simulator** `/simulator` — split screen. Left: chat pane styled *generically* with banner "Clerk Demo Mode — simulated chat, not Discord". Right: live board. Controls: Play / Pause / Speed 1×/2×/4× / Reset.
7. **Stats bar** — sticky top on board/simulator.

**3-minute demo script**
- 0:00–0:20 Hook: "London community leads lose hours a week scrolling chat to find who said they'd do what. Things fall through. Here's Clerk."
- 0:20–0:35 Problem shot: wall of messy messages (simulator paused).
- 0:35–1:20 Press Play. Messages stream; cards fly into columns: venue request for 60 (P0, request), "I'll grab pizza" → task owner Ana, sponsor offer → request/revenue, date change → decision, FAQ → question with drafted reply, memes → ignored (noise counter ticks). Stats "hours saved" climbs.
- 1:20–1:50 Review queue: approve pizza with A → glow → "Ana is on pizza, due Thu" posted. Reassign venue to Sam. Export event .ics.
- 1:50–2:10 Couldn't-handle log: "Clerk is honest about what it didn't understand."
- 2:10–2:30 Real Discord: type message in live server, card appears on board in realtime; run `/digest`.
- 2:30–3:00 Close: open source MIT, any LLM provider via env, Supabase, one-command setup; "another community can run it next week." URL + repo.

---

## 2. PRD

**Problem.** Community leads run events from noisy chat. Requests, volunteer offers, sponsor leads and decisions get buried; nobody knows owners or deadlines; questions go unanswered. Today: scrolling, pinned messages, a Notion page updated manually (if ever).

**Users.** Primary: community lead/organiser (reviewer). Secondary: volunteers (owners), members (askers), sponsors.

**Goals.** Capture ≥90% of actionable messages; every card has type/owner/priority/due/confidence/source link; one-click review; zero public posts without human approval; transparent failure log; runnable by another community in <15 min.

**Non-goals.** Auto-moderation, DMs, multi-platform beyond Discord (Slack later), billing, fine-tuned models.

**User stories**
- As a lead, I see a ranked queue of what needs action so I clear it in minutes.
- As a lead, I approve/edit/reassign/reject with one click/keypress.
- As a volunteer, I get a Discord confirmation when I'm made owner.
- As a lead, I get `/digest` of open, overdue, unanswered, decisions.
- As a lead, I can see what Clerk couldn't handle and claim it.
- As a judge/new community, I can run the simulator without Discord.

**Functional requirements**
- FR1 Bot ingests every guild message (non-bot) with last 5 thread/reply messages as context.
- FR2 Extractor returns strict JSON (schema below); invalid JSON → retry once → failure.
- FR3 Items with confidence <0.6 or type unknown → `failures`. Noise stored but hidden.
- FR4 Ranker computes `urgency_score` 0–100.
- FR5 Review actions write `item_events`; approve triggers post-back (tasks/requests: owner+due line; questions: drafted reply; events: .ics link).
- FR6 Realtime board via Supabase channels.
- FR7 `/digest` and `/clerk status` slash commands.
- FR8 Simulator streams seed to the same `/api/ingest` pipeline with `source='simulator'`.

**Data model — `supabase/migrations/0001_init.sql`**
```sql
create extension if not exists "pgcrypto";
create type item_type as enum ('request','task','event','question','decision','noise');
create type item_status as enum ('pending','approved','posted','done','rejected');
create type priority as enum ('P0','P1','P2','P3');
create type msg_source as enum ('discord','simulator');

create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discord_guild_id text unique,
  post_channel_id text,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  source msg_source not null default 'discord',
  external_id text not null,
  channel_id text, thread_id text, reply_to_external_id text,
  author_name text not null, author_external_id text,
  content text not null,
  permalink text,
  sent_at timestamptz not null default now(),
  processed boolean default false,
  unique (community_id, external_id)
);
create table items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  type item_type not null,
  title text not null,
  summary text,
  owner_name text,
  priority priority not null default 'P2',
  due_at timestamptz,
  confidence real not null check (confidence between 0 and 1),
  urgency_score int not null default 0,
  status item_status not null default 'pending',
  suggested_reply text,
  event_start timestamptz, event_end timestamptz, event_location text,
  source_link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on items (community_id, status, urgency_score desc);
create table item_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  action text not null check (action in ('created','approved','edited','reassigned','rejected','posted','done')),
  actor text not null,
  diff jsonb,
  created_at timestamptz default now()
);
create table failures (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  reason text not null check (reason in ('low_confidence','invalid_json','llm_error','ambiguous_owner','unsupported')),
  confidence real,
  raw jsonb,
  claimed_by text,
  created_at timestamptz default now()
);

alter table communities enable row level security;
alter table messages enable row level security;
alter table items enable row level security;
alter table item_events enable row level security;
alter table failures enable row level security;

-- Owner can read/write own community; service role (bot/API) bypasses RLS.
create policy "own community" on communities for all using (owner_user_id = auth.uid());
create policy "own messages" on messages for all using (community_id in (select id from communities where owner_user_id = auth.uid()));
create policy "own items" on items for all using (community_id in (select id from communities where owner_user_id = auth.uid()));
create policy "own events" on item_events for all using (item_id in (select i.id from items i join communities c on c.id=i.community_id where c.owner_user_id = auth.uid()));
create policy "own failures" on failures for all using (community_id in (select id from communities where owner_user_id = auth.uid()));
-- Demo community: public read so the simulator works without login
create policy "demo read items" on items for select using (community_id = '00000000-0000-0000-0000-000000000001');
create policy "demo read failures" on failures for select using (community_id = '00000000-0000-0000-0000-000000000001');
create policy "demo read messages" on messages for select using (community_id = '00000000-0000-0000-0000-000000000001');

alter publication supabase_realtime add table items, failures, messages;
```

**JSON extraction schema (strict, `packages/core/src/schema.ts`)**
```json
{
  "name": "clerk_extraction",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["items"],
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["type","title","summary","owner_name","priority","due_at","confidence","suggested_reply","event","reasoning"],
          "properties": {
            "type": {"type":"string","enum":["request","task","event","question","decision","noise"]},
            "title": {"type":"string","description":"<=80 chars, imperative"},
            "summary": {"type":"string"},
            "owner_name": {"type":["string","null"]},
            "priority": {"type":"string","enum":["P0","P1","P2","P3"]},
            "due_at": {"type":["string","null"],"description":"ISO 8601, resolved against message sent_at, Europe/London"},
            "confidence": {"type":"number","minimum":0,"maximum":1},
            "suggested_reply": {"type":["string","null"],"description":"only for type=question"},
            "event": {
              "type":["object","null"], "additionalProperties": false,
              "required":["start","end","location"],
              "properties":{"start":{"type":["string","null"]},"end":{"type":["string","null"]},"location":{"type":["string","null"]}}
            },
            "reasoning": {"type":"string","description":"<=20 words"}
          }
        }
      }
    }
  }
}
```

**API contract (Next.js `apps/web/app/api/...`)**
| Route | Body | Response |
|---|---|---|
| `POST /api/ingest` (header `x-clerk-secret: $INGEST_SECRET`) | `IngestRequest` `{communityId, message: IncomingMessage, context: IncomingMessage[]}` | `{messageId, items: Item[], failures: Failure[]}` |
| `GET /api/items?communityId&status&type` | – | `{items: Item[]}` sorted urgency desc |
| `PATCH /api/items/:id` | `{action:'approve'\|'edit'\|'reassign'\|'reject'\|'done', patch?: Partial<Item>, actor}` | `{item: Item}` |
| `POST /api/items/:id/post` | `{actor}` | `{posted:true, text}` (web calls bot via `BOT_POST_URL` or Discord REST w/ bot token) |
| `GET /api/items/:id/ics` | – | `text/calendar` |
| `GET /api/failures?communityId` | – | `{failures: Failure[]}` |
| `POST /api/failures/:id/claim` | `{actor}` | `{failure}` |
| `GET /api/digest?communityId` | – | `Digest` |
| `POST /api/simulator/reset` | `{communityId}` | `{ok:true}` |
| `GET /api/health` | – | `{ok, llm: boolean, db: boolean}` |

Bot ↔ web: bot calls `/api/ingest` and `/api/digest`; for post-back the web calls the Discord REST API directly with `DISCORD_BOT_TOKEN` (`POST /channels/{id}/messages`) — no bot HTTP server needed.

**Realtime channels:** `community:<communityId>:items` (postgres_changes on `items` filter `community_id=eq.<id>`), `community:<communityId>:failures`, `community:<communityId>:messages`. Broadcast channel `community:<communityId>:stats` (optional).

**Repo structure**
```
clerk/
  apps/web/          Next.js 14 app router, Tailwind, shadcn/ui, Framer Motion
    app/(marketing)/page.tsx  app/board  app/review  app/failures  app/digest  app/simulator  app/api/*
    components/ui (shadcn)  components/clerk/*  lib/*
  apps/bot/          discord.js v14
  packages/core/     src/types.ts schema.ts extractor.ts prompt.ts ranker.ts context.ts digest.ts ics.ts index.ts
  supabase/migrations/0001_init.sql  supabase/seed.sql
  demo/seed/         london-meetup.json  eval/
  docs/  LICENSE (MIT)  README.md  .env.example  pnpm-workspace.yaml  turbo.json
```

**Env vars (`.env.example`)**
```
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DISCORD_BOT_TOKEN=
DISCORD_APP_ID=
DISCORD_GUILD_ID=
CLERK_API_URL=http://localhost:3000
INGEST_SECRET=
DEMO_COMMUNITY_ID=00000000-0000-0000-0000-000000000001
CONFIDENCE_THRESHOLD=0.6
```

**Success metrics.** Eval: type accuracy ≥85%, owner F1 ≥0.8 on G2 test set; ingest→card <3s p50; review time per item <5s; 0 unapproved public posts; setup <15 min.

**Risks & mitigations.** LLM latency/outage → simulator has cached-extraction fallback (`demo/seed/london-meetup.json` includes expected items, `SIMULATOR_OFFLINE=1`). Discord permissions/wifi on stage → simulator. Hallucinated owners → owner must be a name in message/context else null + `ambiguous_owner`. Privacy → only opted-in channels, MIT self-host, no message leaves your Supabase except to your chosen LLM. Merge conflicts → strict folder ownership.

---

## 3. SHARED BRIEF (paste at top of EVERY session)

```
=== CLERK SHARED BRIEF (contract — do not deviate) ===
Project: Clerk — open-source (MIT) Discord bot + web board that turns community chat messages into tasks with owner+priority, with a human review queue and a visible "couldn't handle" log. Hackathon: Grok Bot Community Engineering London, Track 5. Code freeze 21:50 London. You have 45 minutes.

Monorepo (pnpm workspaces, TypeScript strict, Node 20):
  apps/web      Next.js 14 app router + Tailwind + shadcn/ui + Framer Motion (dark mode)
  apps/bot      discord.js v14
  packages/core shared types, extractor, ranker, context, digest, ics  (import as "@clerk/core")
  supabase/migrations  SQL;  demo/seed  JSON seed;  docs/

Shared types — packages/core/src/types.ts (source of truth, do NOT edit unless you own it):
export type ItemType = 'request'|'task'|'event'|'question'|'decision'|'noise';
export type ItemStatus = 'pending'|'approved'|'posted'|'done'|'rejected';
export type Priority = 'P0'|'P1'|'P2'|'P3';
export type FailureReason = 'low_confidence'|'invalid_json'|'llm_error'|'ambiguous_owner'|'unsupported';
export interface IncomingMessage { externalId: string; channelId?: string; threadId?: string; replyToExternalId?: string; authorName: string; authorExternalId?: string; content: string; permalink?: string; sentAt: string; source: 'discord'|'simulator'; }
export interface ExtractedItem { type: ItemType; title: string; summary: string; owner_name: string|null; priority: Priority; due_at: string|null; confidence: number; suggested_reply: string|null; event: {start:string|null; end:string|null; location:string|null}|null; reasoning: string; }
export interface Item { id: string; communityId: string; messageId: string; type: ItemType; title: string; summary: string|null; ownerName: string|null; priority: Priority; dueAt: string|null; confidence: number; urgencyScore: number; status: ItemStatus; suggestedReply: string|null; eventStart: string|null; eventEnd: string|null; eventLocation: string|null; sourceLink: string|null; createdAt: string; updatedAt: string; }
export interface Failure { id: string; communityId: string; messageId: string|null; reason: FailureReason; confidence: number|null; raw: unknown; claimedBy: string|null; createdAt: string; messageContent?: string; authorName?: string; }
export interface IngestRequest { communityId: string; message: IncomingMessage; context: IncomingMessage[]; }
export interface IngestResponse { messageId: string; items: Item[]; failures: Failure[]; }
export type ReviewAction = 'approve'|'edit'|'reassign'|'reject'|'done';
export interface ReviewRequest { action: ReviewAction; patch?: Partial<Pick<Item,'title'|'ownerName'|'priority'|'dueAt'|'type'|'suggestedReply'>>; actor: string; }
export interface Digest { generatedAt: string; open: Item[]; overdue: Item[]; unansweredQuestions: Item[]; decisions: Item[]; stats: { captured: number; pending: number; approved: number; failures: number; hoursSaved: number }; }
export interface SimScriptStep { delayMs: number; message: IncomingMessage; cachedItems?: ExtractedItem[]; }
export const CONFIDENCE_THRESHOLD = 0.6;
export const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';

Core function signatures (packages/core):
  extract(input: IngestRequest, opts?: {baseUrl,apiKey,model}): Promise<{items: ExtractedItem[]; failure?: {reason: FailureReason; raw: unknown}}>   // extractor.ts
  rankUrgency(item: ExtractedItem|Item, now?: Date): number   // ranker.ts, 0-100
  buildContext(msg: IncomingMessage, history: IncomingMessage[], max=5): IncomingMessage[]   // context.ts
  buildDigest(items: Item[], failures: Failure[], now?: Date): Digest   // digest.ts
  formatPostBack(item: Item): string   // digest.ts e.g. "✅ Ana is on pizza, due Thu"
  toIcs(item: Item): string   // ics.ts

REST: POST /api/ingest (x-clerk-secret) · GET /api/items · PATCH /api/items/:id · POST /api/items/:id/post · GET /api/items/:id/ics · GET /api/failures · POST /api/failures/:id/claim · GET /api/digest · POST /api/simulator/reset · GET /api/health
DB tables (snake_case): communities, messages, items, item_events, failures. Map snake_case<->camelCase in apps/web/lib/db.ts.
Realtime channels: community:<id>:items, community:<id>:failures, community:<id>:messages
Env: LLM_BASE_URL LLM_API_KEY LLM_MODEL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DISCORD_BOT_TOKEN DISCORD_APP_ID DISCORD_GUILD_ID CLERK_API_URL INGEST_SECRET DEMO_COMMUNITY_ID CONFIDENCE_THRESHOLD
Design tokens: bg #0B0D14, surface #141826 (60% + blur), primary #7C5CFF, accent #22D3EE, request #F59E0B, task #7C5CFF, event #22D3EE, question #60A5FA, decision #34D399, noise #4B5163, urgent #F43F5E. Fonts: Inter, Space Grotesk (headings), JetBrains Mono.

Rules:
- Work on branch feat/<your-prompt-id> (e.g. feat/C4). Small commits.
- ONLY create/edit files in the folders you own (listed in your task). If you need something you don't own, MOCK it locally against this contract (e.g. a fixtures file inside your own folder) — never edit another owner's file.
- Naming: kebab-case files, PascalCase components, camelCase TS, snake_case SQL.
- UK English in all copy. Nothing is ever posted publicly without human approval.
- MIT licence. No secrets committed; use .env.local / .env.example only.
- If you have no repo access, output complete files with their paths as fenced code blocks.
- Finish within 45 minutes. END with: summary of files created/changed, how to test, any contract assumptions.
=== END BRIEF ===
```

---

## 4. Prompts

> Paste the SHARED BRIEF first, then the prompt. Ownership is exclusive.

### Claude (C1–C15)

**C1 — Design system + hero + board visuals**
Own: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`, `apps/web/components/ui/**` (shadcn), `apps/web/components/clerk/brand/**`, `apps/web/app/(marketing)/**`, `apps/web/app/layout.tsx`.
Deliver: Tailwind theme with all tokens as CSS vars, glass utility (`.glass`), fonts via next/font, shadcn Button/Badge/Card/Dialog/Input/Select/Tooltip/Tabs, `Logo`, `TypeChip`, `PriorityBadge`, `GlowBackground`. Landing hero ("Every message. Owned.") with animated looping mini-board (static fixture data), CTAs to /simulator and GitHub, footer "MIT · open source". Layout with dark mode default and top nav (Board, Review, Couldn't handle, Digest, Simulator).
Accept: `pnpm --filter web build` passes; Lighthouse a11y ≥90; reduced-motion respected. Mock: board data from inline fixture.

**C2 — ItemCard component + animations**
Own: `apps/web/components/clerk/card/**`.
Deliver: `ItemCard` (type chip, title, owner avatar w/ initials, priority, due relative "due Thu", source link, `ConfidenceRing` SVG), `ApproveBurst` particle effect, layoutId support (`msg-<messageId>`), variants for pending/approved/posted/rejected, compact mode.
Accept: Storybook-free demo page not needed; export from `index.ts`; props typed with `Item`. Mock: fixture items in `card/fixtures.ts`.

**C3 — Live board page**
Own: `apps/web/app/board/**`, `apps/web/components/clerk/board/**`.
Deliver: Kanban columns Inbox/Approved/Posted/Done, filter chips by type, sorted by urgencyScore, AnimatePresence + layout animations; consumes `useItems(communityId)` from `@/lib/realtime` (C14) — import it; if missing, use a local mock hook in `components/clerk/board/mock-hook.ts`. Empty state copy.
Accept: cards move columns animatedly when status changes.

**C4 — Review queue**
Own: `apps/web/app/review/**`, `apps/web/components/clerk/review/**`.
Deliver: list + focus panel; source message + context; edit drawer (title/owner/priority/due/type/reply); keyboard A/E/R/X/J/K; calls `PATCH /api/items/:id` then `POST /api/items/:id/post` on approve (confirm dialog "Post to Discord?"). Optimistic UI + toast.
Accept: full flow with mocked fetch (`review/api-client.ts`) against contract.

**C5 — Couldn't-handle log**
Own: `apps/web/app/failures/**`, `apps/web/components/clerk/failures/**`.
Deliver: table with message, author, reason badge, confidence, time, "Claim" button (POST claim), header copy "What Clerk couldn't handle — honestly." Realtime via `useFailures`.
Accept: claimed rows dim with name.

**C6 — Digest view**
Own: `apps/web/app/digest/**`, `apps/web/components/clerk/digest/**`.
Deliver: GET /api/digest render: open by owner, overdue (red), unanswered questions, decisions; "Copy as Discord markdown" and "Post digest" (approval dialog).
Accept: matches `Digest` type; works with fixture.

**C7 — Simulator UI**
Own: `apps/web/app/simulator/**`, `apps/web/components/clerk/simulator/**`.
Deliver: split screen; left generic chat pane (NOT Discord branding; banner "Clerk Demo Mode — simulated community chat"); right reuses board (import C3's `Board` component or local mock); controls Play/Pause/Speed/Reset; Stats bar (captured, awaiting review, hours saved, couldn't handle) with rolling numbers. Player reads `demo/seed/london-meetup.json` via `loadScript()` from C8 and POSTs each step to `/api/ingest` (source simulator); if `NEXT_PUBLIC_SIMULATOR_OFFLINE=1` or API fails, inserts `cachedItems` client-side.
Accept: runs fully offline in <90s at 1×.

**C8 — Simulator script + seed loader**
Own: `demo/seed/**` (except `demo/seed/eval/**`), `supabase/seed.sql`, `apps/web/lib/sim-script.ts`.
Deliver: `london-meetup.json` (SimScriptStep[] ~30 messages; use G1 output if provided, else write it: venue for 60 people in Shoreditch, Ana volunteers pizza for Thu, sponsor offer from a fintech, date change Thu→Wed, FAQ "is there step-free access?", memes, ambiguous "someone should sort the mic"), with `cachedItems`. `seed.sql` inserts demo community `00000000-…0001`. `loadScript()` exported.
Accept: JSON validates against `SimScriptStep`.

**C9 — Extractor prompt + schema**
Own: `packages/core/src/prompt.ts`, `packages/core/src/schema.ts`, `packages/core/src/extractor.ts`, `packages/core/test/extractor.test.ts`.
Deliver: system prompt (community-aware: London, Europe/London date resolution, owner only if named, noise examples, few-shots), strict JSON schema (section 2), `extract()` using fetch to `${LLM_BASE_URL}/chat/completions` with `response_format: {type:'json_schema', json_schema}`; fallback to `json_object` if provider rejects; zod validation; retry once; returns failure reasons; applies CONFIDENCE_THRESHOLD.
Accept: vitest with mocked fetch covers valid, invalid JSON, low confidence.

**C10 — Priority ranker**
Own: `packages/core/src/ranker.ts`, `packages/core/test/ranker.test.ts`.
Deliver: `rankUrgency`: base by priority (P0 70, P1 50, P2 30, P3 10) + due proximity (≤24h +25, ≤72h +15, overdue +30) + type weight (request +5, question unanswered >12h +10) + keywords (urgent, asap, tonight) capped 100.
Accept: deterministic tests.

**C11 — Thread-context linker + digest/postback/ics**
Own: `packages/core/src/context.ts`, `packages/core/src/digest.ts`, `packages/core/src/ics.ts`, `packages/core/test/context.test.ts`, `packages/core/test/digest.test.ts`.
Deliver: `buildContext` (same thread first, then reply chain, then same-channel within 10 min, max 5), `buildDigest`, `formatPostBack` ("✅ Ana is on pizza, due Thu" / "📅 Event: …" / "💬 Suggested reply"), `toIcs` (RFC 5545, Europe/London TZID).
Accept: tests pass.

**C12 — Supabase schema + RLS**
Own: `supabase/migrations/**`, `supabase/config.toml`.
Deliver: `0001_init.sql` exactly as PRD section 2 plus `updated_at` trigger; `0002_views.sql` with `item_stats` view per community.
Accept: `supabase db reset` clean; realtime publication set.

**C13 — README, docs, licence**
Own: `README.md`, `LICENSE`, `docs/**`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/**`.
Deliver: MIT LICENSE (2026, "Clerk contributors"); README: what/why, screenshot placeholders, 15-min quickstart (Supabase, Discord app with Message Content intent, env, `pnpm dev`), any-LLM-provider section, architecture (paste G4 mermaid), privacy statement, "Run it for your community next week" checklist.
Accept: a stranger can follow it.

**C14 — Realtime hooks + data client**
Own: `apps/web/lib/realtime.ts`, `apps/web/lib/supabase-browser.ts`, `apps/web/lib/db.ts`.
Deliver: browser client; `useItems(communityId)`, `useFailures(communityId)`, `useMessages(communityId)`, `useStats(communityId)` subscribing to channel names in brief, initial fetch via REST; `db.ts` snake↔camel mappers `rowToItem`, `itemToRow`, `rowToFailure`.
Accept: typed; reconnect handling; no service key in browser.

**C15 — Core barrel + edge-case hardening**
Own: `packages/core/src/index.ts`, `packages/core/src/types.ts`, `packages/core/test/fixtures/**`, `packages/core/src/guards.ts`.
Deliver: types.ts verbatim from brief; index re-exports all modules; `guards.ts` (prompt-injection stripping, max length 4000, bot/self message skip, emoji-only → noise shortcut without LLM); fixtures from G5 edge cases.
Accept: `pnpm --filter @clerk/core build` and tests pass.

### ChatGPT (G1–G5) — no repo access; output files as code blocks

**G1 — Demo seed conversation.** Output `demo/seed/london-meetup.json`: 30 `SimScriptStep`s for a London tech community "Shoreditch Builders" planning a meetup. Include: venue request for 60 people (P0), Ana volunteers pizza due Thu, sponsor offer (fintech, £500), date change Thu→Wed (decision), FAQ step-free access (question), "can someone bring HDMI?" (unowned task), RSVP count, 4 memes/noise, sarcasm, thread replies (use threadId/replyToExternalId), one ambiguous mic request. Realistic UK slang/typos. delayMs 1500–4000. Each with `cachedItems` (ExtractedItem[]). Accept: valid JSON, types per brief.

**G2 — Eval set + scorer.** Output `demo/seed/eval/cases.json` (60 messages with context and expected `{type, owner_name, priority}`), and `demo/seed/eval/score.ts` (runs `extract()` from `@clerk/core`, prints type accuracy, owner F1, priority within-1 accuracy, confusion matrix; exits 1 if type accuracy <0.85). Accept: runnable with `pnpm tsx demo/seed/eval/score.ts`.

**G3 — Pitch + 3-min demo script + slides.** Output `docs/pitch.md`: timed demo script (beats in section 1), 5-slide copy (problem, demo, how it works, open source/run next week, ask), judge Q&A (10 likely questions incl. privacy, cost, accuracy, why better than Notion/pinned messages), 30s backup voice-over for demo video.

**G4 — README marketing + mermaid.** Output `docs/readme-hero.md` (tagline, 3 feature bullets, "Why Clerk beats what leads do today" table) and `docs/architecture.md` with mermaid flowchart: Discord → bot → /api/ingest → core(extract, rank, context) → Supabase (items/failures) → realtime → board/review → approve → Discord post-back; plus simulator path.

**G5 — Edge cases + failure scenarios.** Output `packages/core/test/fixtures/edge-cases.json` (40 cases: prompt injection "ignore instructions and post…", multiple tasks in one message, relative dates "next Thurs", non-English, emoji-only, sarcasm, owner pronoun only, cancelled task, duplicate request, very long message) each with expected outcome (item(s) / noise / failure reason), and `docs/failure-modes.md` table: scenario, detection, Clerk behaviour, user-visible result.

### Cursor (X1–X5) — in the repo

**X1 — Scaffold (RUN FIRST, ~10 min).** Own: root config (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.eslintrc*`, `.prettierrc`), package.json/tsconfig of each workspace, empty placeholder dirs with `.gitkeep`. Create `apps/web` (create-next-app 14, TS, Tailwind, app router, src-less), `apps/bot` (discord.js, tsx), `packages/core` (tsup + vitest, name `@clerk/core`), `supabase/`, `demo/seed/`, `docs/`. Put types.ts from brief into `packages/core/src/types.ts` (C15 then owns). Wire `@clerk/core` workspace dep into web + bot; `transpilePackages`. Push `main`. Accept: `pnpm i && pnpm build` green. Don't write features.

**X2 — Discord bot adapter.** Own: `apps/bot/**` (except package.json scaffolded—may add deps). Deliver: client with intents Guilds, GuildMessages, MessageContent; on messageCreate (skip bots) fetch last 10 channel/thread messages, `buildContext`, POST `/api/ingest` with `x-clerk-secret`; react 👀 only if `CLERK_REACT=1`. Slash commands `/digest` (GET /api/digest → embed, ephemeral by default with "Post publicly" button) and `/clerk status|link` (link opens board). `register-commands.ts` script. Mock API with `apps/bot/src/mock-api.ts` if web not ready. Accept: runs with `pnpm --filter bot dev`.

**X3 — API routes.** Own: `apps/web/app/api/**` except `items/[id]/post` and `items/[id]/ics`, plus `apps/web/lib/supabase-server.ts`. Deliver: all routes in contract using service role server-side; ingest: verify secret, upsert message, `extract`, `rankUrgency`, insert items/failures, item_events 'created'; `/api/health`. Use `rowToItem` from `@/lib/db` (C14; mock locally in route file's sibling `_mock-db.ts` if absent). Accept: curl examples in summary all work against local Supabase.

**X4 — Approve & post-back + .ics.** Own: `apps/web/app/api/items/[id]/post/route.ts`, `apps/web/app/api/items/[id]/ics/route.ts`, `apps/web/lib/discord-rest.ts`. Deliver: post only if status approved (else 409); `formatPostBack`; Discord REST POST to community `post_channel_id` (or reply to source message via `message_reference`); status→posted + item_events 'posted'; simulator community → no Discord call, just mark posted. ICS download via `toIcs`. Accept: never posts without approved status; tested with mocked fetch.

**X5 — Integrate, deploy, smoke test (RUN LAST, from 21:05).** Own: `scripts/**`, `vercel.json`, `.github/workflows/**`, `e2e/**`. Merge branches in order (below), resolve conflicts preferring the owner's file, fix imports/types, deploy web to Vercel (env vars set in dashboard), bot on Railway/Fly or locally on the laptop, `scripts/smoke.ts`: health → ingest 3 messages → items appear → approve → post → digest. GitHub Action: install, typecheck, test. Accept: live URL, smoke green, repo public.

---

## 5. Run order & coordination

**Timeline (BST)**
- **19:30** Start X1 (scaffold). Meanwhile paste G1–G5 into ChatGPT (no repo needed) and create Supabase project + Discord app (enable Message Content intent, invite to test server).
- **19:40** X1 pushed `main`. Launch all Claude C1–C15 and Cursor X2–X4 in parallel, each on `feat/<id>` from `main`.
- **20:00** Checkpoint 1: drop G1 JSON into C8's session, G5 into C15, G4 mermaid into C13. Run C12 migration on Supabase.
- **20:25** Checkpoint 2: sessions finishing; collect summaries. Merge wave 1.
- **20:45** Checkpoint 3: merge wave 2; first end-to-end simulator run locally.
- **21:05** X5 integration + deploy. Record backup demo video of simulator (2–3 min, screen + voice from G3).
- **21:30** Feature freeze; smoke test on live URL; README screenshots.
- **21:45** Submit. **21:50 code freeze.**

**Merge order:** 1) X1 (already main) → 2) C15 core types/barrel, C12 schema → 3) C9, C10, C11 core logic → 4) C14 data/realtime, C1 design system → 5) X3 API, X4 post-back → 6) C2 card → C3 board → C4, C5, C6 → 7) C8 seed → C7 simulator → 8) X2 bot → 9) C13 docs (+G outputs) → X5.

**What to tell each session:** "[SHARED BRIEF] + [prompt Cn]. Branch feat/Cn from latest main. Only touch your owned paths. Mock the rest. 45 minutes. End with file summary." For ChatGPT: "[BRIEF] + [Gn]. Output complete files as fenced code blocks with paths." Then commit their output to the target path on `feat/Gn` yourself (paths don't overlap with C/X).

**Fallback plan:** If Discord/wifi fails on stage → demo entirely in `/simulator` with `NEXT_PUBLIC_SIMULATOR_OFFLINE=1` (cached extractions, no LLM, no network beyond localhost). If Supabase realtime fails → simulator uses client-side state. If live deploy fails → run `pnpm dev` locally. Last resort → backup video.

**Submission checklist**
- [ ] Repo public on GitHub, `LICENSE` (MIT) at root
- [ ] README quickstart works from clean clone; `.env.example` complete, no secrets in git history (`git log -p | grep -i key` sanity check)
- [ ] Live URL (Vercel) + `/simulator` works logged-out
- [ ] Demo video backup (≤3 min) uploaded/unlisted
- [ ] Simulator clearly labelled "Clerk Demo Mode"
- [ ] Eval score in README (from G2)
- [ ] Partner tools named: Supabase, Cursor, Grok Bot (+ Notion export stretch)
- [ ] 3-min script rehearsed twice; laptop on charge, offline mode tested
