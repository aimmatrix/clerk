# Clerk — Pitch, demo and slides

G3 deliverable · Grok Bot Community Engineering London Hackathon · Track 5: Front Desk & Revenue

**Every message. Owned.**

Clerk turns community chat into a ranked queue of tasks, requests, events, questions and decisions, with human review before public posts and a visible log of what it couldn't handle.

## Three-minute demo script

Stage directions are not spoken. Use the simulator for the main story; identify the separate live Discord segment explicitly. The script follows the Build Pack's intended flow; rehearse against the integrated build before presenting.

### 0:00–0:20 — Hook

**Show:** Slide 1, then the paused simulator with a wall of chat.

**Say:** “You're organising a community meetup. Somewhere in this chat is a venue request, a pizza volunteer and a sponsor offer. Finding them means scrolling; following up means remembering. Clerk turns those messages into a queue you can act on.”

### 0:20–0:35 — Problem shot

**Show:** Point to the venue request and volunteer message among the chatter. Keep the Demo Mode banner visible.

**Say:** “This is Shoreditch Builders, our simulated community. Sixty people need a venue. Ana has offered pizza. The date has changed. The organiser needs to know what matters, who owns it and what's still unresolved.”

### 0:35–1:20 — Messages become work

**Do:** Press Play at the rehearsed speed. Point to cards as they appear: venue, pizza, sponsor, date change, accessibility question. Finish this beat by 1:20 even if playback is still running.

**Say:** “Press Play. The venue request becomes a P0 card. Ana's offer becomes a task with her name and a Thursday deadline. The fintech's £500 offer becomes a sponsor request to follow up. That's an opportunity captured, not revenue booked.

“The date change becomes a decision. The step-free access question gets a draft reply for review. Memes stay out of the action queue. Each card keeps its source and confidence, so you can check the suggestion.

“These counters track the queue. Hours saved is an estimate: four minutes per approved item.”

### 1:20–1:50 — Human review and approval

**Do:** Pause playback. Open Review. Select Ana's pizza task; press A and confirm the post. Show the simulated posted state. Reassign the venue request to Sam. Export the event's .ics file if that control is available.

**Say:** “I check Ana's task against the source, press A and confirm the post. In demo mode, that simulates the confirmation. In Discord, approval allows the public post. I assign the venue follow-up to Sam. The event can also be exported to a calendar. The organiser stays in control.”

**Presenter note:** If the meetup has moved to Wednesday, check the pizza deadline before approving. Edit the date only after confirming the intent; do not imply Clerk automatically reconciles earlier commitments. If this needs extra time, omit the calendar click.

### 1:50–2:10 — Honest failure

**Show:** Couldn't-handle log; select a rehearsed ambiguous or low-confidence message and use Claim.

**Say:** “What happens when Clerk isn't sure? It puts uncertain extractions here for a person to claim. An ambiguous mic request shouldn't become a confident assignment to a guessed volunteer. This log makes unresolved work visible instead of hiding it behind a tidy board.”

### 2:10–2:30 — Live Discord and digest

**Do:** Switch to the real test server. Send a pre-rehearsed message from a human account: “I'll bring the HDMI adaptor by tomorrow.” Show the new pending card. Run /digest; keep the response private unless you deliberately approve a public post.

**Say:** “Now this is the live Discord connection. I send a new commitment, and it appears for review. The digest brings together open work, overdue tasks, unanswered questions and recent decisions. Public posting still needs human approval.”

**Fallback:** If a card has not appeared within five seconds, switch back to the simulator or the recorded clip. Say: “The live connection hasn't responded; this is the recorded flow.” Do not describe cached results as live extraction.

### 2:30–3:00 — Close and ask

**Show:** Slides 4 and 5, with the verified repository and demo links.

**Say:** “Clerk is designed for another community to run next week: MIT-licensed code, Supabase for storage and realtime updates, and a configurable OpenAI-compatible model provider. Try the simulator without a Discord setup.

“We're looking for community organisers to pilot it at their next meetup and help us measure what it captures and what it misses. Every message. Owned.”

## Five-slide copy

### Slide 1 — Problem

**Headline:** Your next meetup is buried in chat.

- A venue request. A volunteer offer. A sponsor lead.
- Commitments disappear between replies and memes.
- Someone still has to find, assign and chase them.

**Visual:** Three highlighted messages inside a busy, generic chat view.

### Slide 2 — Demo

**Headline:** Every message. Owned.

- Capture tasks, requests, events, questions and decisions.
- Review suggested owners, priorities and deadlines beside the source.
- Approve the post; claim anything Clerk couldn't handle.

**Visual:** Simulated chat on the left, ranked board on the right. Keep the Demo Mode label visible.

### Slide 3 — How it works

**Headline:** Chat → context → extraction → review → approved post.

- The bot sends messages and relevant conversation context to the ingest API.
- Shared core code validates structured output and ranks urgency.
- Supabase stores items and failures, then updates the board in realtime.
- A human reviews; approval permits the Discord post-back.

**Footnote:** The simulator can use cached extractions when the live pipeline is unavailable.

### Slide 4 — Open source / run next week

**Headline:** Bring Clerk to your community.

- MIT-licensed, with a self-hosting path.
- Configure your Supabase project, Discord app and compatible model provider.
- Explore the simulator before connecting a server.

**Footnote:** Setup target: under 15 minutes. Verify with a clean installation before claiming a measured result.

**Visual:** Verified repository URL and simulator URL, or QR codes pointing to them.

### Slide 5 — Ask

**Headline:** Help us catch what your community misses.

- Pilot Clerk at your next meetup.
- Check captured commitments and missed actions against the original chat.
- Share confusing messages, corrections and setup friction.

**Closing line:** Try the demo. Run the code. Bring one real community.

## Judge Q&A — ten likely questions

### 1. Why is this better than Notion or pinned messages?

Those tools are useful once someone has identified and written down the work. Clerk addresses that capture step: it finds candidate actions in chat, attaches the source and puts them in a review queue. A community can keep using its existing planning tools; Notion export is a stretch goal, not a promised feature.

### 2. What happens to private community messages?

The intended data path is the community's deployment, its Supabase database and its chosen model provider. Limit the bot's channel access to channels the community has agreed to process. Message content and supplied context reach the configured provider during live extraction; we do not claim that data stays entirely local. Confirm channel permissions, database access policies and provider settings before a pilot.

### 3. How much does it cost?

There is no measured production cost to quote yet. Operating cost depends on hosting, database usage, message volume, context size and the chosen provider. Calculate model cost from input tokens × input rate plus output tokens × output rate, including retries. The cached simulator makes no model calls; hosting costs may still apply.

### 4. How accurate is it?

The Build Pack targets at least 85% type accuracy and 0.8 owner F1 on the G2 evaluation set; those are targets, not reported results. We should publish the actual score with the model and configuration used, then measure missed actions on real, consented community conversations. Confidence is a routing signal, not a verified probability of correctness.

### 5. Can it invent an owner, deadline or accessibility answer?

It can make mistakes. The intended extraction rules restrict owners to names supported by the message or context; unsupported ownership stays unassigned or is flagged. Suggested dates and replies remain visible for review. An accessibility question without reliable evidence should lead to a request for confirmation, not an invented venue fact.

### 6. Can it post without permission?

The design requires human approval before any public post. The item post-back endpoint must reject an item that is not approved, and the review flow asks for confirmation. The demo community simulates posting. We should demonstrate and test that server-side gate before claiming it is enforced in a deployed build; digest publication also requires explicit approval.

### 7. What if the model or Discord is unavailable?

Live processing errors should appear in the couldn't-handle log. For the presentation, the simulator can use cached extractions and local state; a recorded demo is the final fallback. Those fallbacks demonstrate the workflow, not live model accuracy. We are not claiming an implemented durable retry queue or automatic recovery after an outage.

### 8. What makes the queue useful beyond classification?

Clerk combines type with suggested ownership, due dates, source context and urgency. The ranker uses explicit priority, deadline proximity and other defined signals to order the queue. Organisers can edit, reassign or reject suggestions. The failure log keeps uncertain work visible alongside successful extractions.

### 9. Is the £500 sponsorship or “hours saved” a real result?

The £500 is a simulated sponsor offer, not money received. The hours-saved counter assumes four minutes per approved item; it is an illustrative estimate, not measured productivity. A pilot should compare review and follow-up time with the organiser's current process before we claim savings.

### 10. Could another community run this next week, and what would you build next?

That is the goal: documented setup for the web app, bot, database and chosen model provider, plus a simulator to explore first. The under-15-minute setup time remains a target until a new organiser verifies it. Next priorities are pilot evidence, reliable handling of retries and duplicate messages, and better treatment of changed or cancelled commitments. Multi-platform support and Notion export remain future work.

## Thirty-second backup voice-over

**Read at roughly 130 words per minute. Show a recorded simulator capture with the Demo Mode banner visible.**

“Community chat moves fast. Commitments get buried. This recorded Clerk demo turns a simulated meetup conversation into a ranked queue: a venue request, Ana's pizza task, a sponsor lead and an accessibility question. Every card keeps its source. An organiser reviews suggestions before a public post is allowed. Uncertain messages go into an honest couldn't-handle log. Try the simulator, then help pilot Clerk in your community.”

## Rehearsal and contract assumptions

- G3 delivers copy in this file; slide copy does not imply a rendered slide deck or a recorded video exists.
- Before presenting, verify the integrated review, claim, export, post-back and digest flows. Replace any unavailable action with an accurate explanation; do not act out an unsupported result.
- Rehearse twice with a three-minute timer. Prepare tabs in order: simulator, review, failures, live test server, board, closing slide. Pause streaming before reviewing.
- Check the ambiguous mic example reaches the failure log with the selected model or cached data; an unowned but otherwise valid task may correctly remain in the review queue instead.
- Keep a valid event ready for .ics export. A date-change decision alone does not guarantee an earlier event or task has been updated.
- Approval drives the hours-saved estimate. Do not claim it increases merely because messages arrive.
- Replace repository/demo placeholders on the slides with verified links. No deployment URL, evaluation score, operating cost, saved time or realised revenue has been invented here.
- Test the labelled offline simulator and recorded-video fallback before the pitch. Keep the live segment to twenty seconds.

## G3 hand-off

**File created:** `docs/pitch.md` — timed script, five slides of copy, ten judge answers and a thirty-second backup voice-over.

**How to test:** Read the spoken sections aloud against a three-minute timer; check that each stage action is available in the integrated build; time the backup read at thirty seconds; verify links and every numerical claim before presenting.

**Assumptions:** Uses the Build Pack's shared types, approval contract, Shoreditch Builders scenario and fallback plan. Product flows are rehearsal requirements, not assertions that the deployed system has been tested. No other owner's implementation is changed.
