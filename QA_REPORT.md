# Clerk live QA — 22 October 2026

**YES WITH RISKS.** The redesigned app, real message ingestion, browser approval and Discord reply, calendar export, failure claiming, digest, and both simulator modes worked live. Model latency misses the PRD target; private-community websocket delivery needs an authenticated owner session and currently reconciles through REST. The timed simulator runs exclude the spoken pitch.

**Targets:** http://localhost:3001 (normal production build), http://localhost:3002 (offline production build). Localhost was requested; no deployed Vercel target was tested. The final live-community navigation was additionally checked on http://localhost:3003 before promotion to port 3001. The development server was also exercised on port 3000. Chrome/Playwright performed browser checks; Safari was used for the existing logged-in Discord test server. APIs used real curl, the configured hosted Supabase database, and gpt-4o-mini. Cached simulator results are explicitly labelled.

Evidence is local in qa-results/ and qa-screenshots/ under the repository root. Screenshots of command output are labelled **captured command/API evidence**, not presented as application screens. Private Discord screenshots and raw QA data are deliberately excluded from the public repository. Public-safe demo screenshots and a real simulator recording are in docs/img/.

Final application fix commit: **56dd3b6**. Public main includes the redesigned UI and the fixes below.

## Task inventory

All implementation ownership areas are present and integrated into local main for submission. “DONE” means the relevant implementation and acceptance evidence were checked; it does not imply the performance targets or an unperformed deployment passed. The user-approved light redesign supersedes the original dark/glow styling requirements.

| Task | Owned files / deliverable | In main | Status | Evidence or gap |
|---|---|---|---|---|
| C1 | theme, globals, UI, brand, marketing, layout | Yes | DONE | Final light redesign builds; Lighthouse accessibility 100; reduced-motion browser check. GlowBackground intentionally replaced by the approved redesign. |
| C2 | components/clerk/card/** | Yes | DONE | Typed Item cards, confidence, owner, status and approval effects visible in live board/simulator. |
| C3 | app/board/**, components/clerk/board/** | Yes | DONE | Live inserts appeared without navigation; filtered and ranked columns rendered; approval/post states exercised. |
| C4 | app/review/**, components/clerk/review/** | Yes | DONE | Source/context, A confirmation, real post, E edit, R reassign, X reject, J/K navigation passed in browser. |
| C5 | app/failures/**, components/clerk/failures/** | Yes | DONE | Actual low-confidence message visible; browser claim persisted and dimmed row; mobile overflow fixed. |
| C6 | app/digest/**, components/clerk/digest/** | Yes | DONE | Live digest, clipboard markdown, confirmation and simulated web post passed; real slash-command publication also observed. |
| C7 | app/simulator/**, components/clerk/simulator/** | Yes | DONE | Thirty messages, animations, controls, inline approval/post, normal and network-disconnected playback under 90 seconds. Separate Review/Discord steps need connectivity. |
| C8 | demo/seed/**, seed.sql, lib/sim-script.ts | Yes | DONE | Thirty-step script loads and plays; cached extraction schema used offline; ambiguous mic beat corrected to the specified phrase. |
| C9 | core prompt/schema/extractor + tests | Yes | DONE | Real provider curl JSON validated; retry/invalid JSON/confidence tests pass; London DST regression fixed. |
| C10 | core ranker + tests | Yes | DONE | Missing existing implementation restored; 41 ranker tests pass. |
| C11 | core context/digest/ics + tests | Yes | DONE | Context/digest tests pass; downloaded calendar independently parsed with correct London times. |
| C12 | supabase/migrations/**, config.toml | Yes | PARTIAL | Both migrations and seed applied to the actual hosted project; five tables, enums, eight policies and realtime verified. Fresh local db reset unverified because Docker is stopped. |
| C13 | README, LICENSE, docs, contributing, issue templates | Yes | DONE | MIT licence, setup, architecture, actual screenshots and recorded GIF included. Setup was followed with existing credentials; a fresh stranger's 15-minute setup is not measured. |
| C14 | realtime.ts, supabase-browser.ts, db.ts | Yes | PARTIAL | Demo received an actual postgres_changes insert. Private community lacks browser owner authentication, so updates use the fixed REST reconciliation fallback. |
| C15 | core barrel/types/guards/fixtures | Yes | DONE | Shared types match the brief after TypeScript formatting; all 205 core tests pass, including edge-case fixtures. |
| G1 | London meetup seed conversation | Yes | DONE | Required venue, pizza, sponsor, date, FAQ, noise and mic beats present; live and cached playback complete. |
| G2 | 60-case eval and scorer | Yes | DONE | Real gpt-4o-mini evaluation: 59/60 type accuracy, owner F1 0.9333, priority within-one 60/60. |
| G3 | pitch, timed script, five-slide copy, Q&A | Yes | DONE | Deliverables present; full scripted simulator playback and individual actions tested. Spoken narration was not timed; real Discord actions passed separately. |
| G4 | README hero and architecture | Yes | DONE | Marketing copy and Mermaid architecture present; rendered README assets supplied. |
| G5 | 40 edge cases and failure-modes documentation | Yes | DONE | Fixtures present and consumed by guard tests; failure-mode documentation present. |
| X1 | workspace scaffold/config/packages | Yes | DONE | Workspace install and final web/core/bot checks pass. |
| X2 | apps/bot/** | Yes | DONE | Bot started from local environment; a real human message reached ingest; /digest private response and explicitly approved public publication observed. /clerk status/link registered; not separately invoked in this audit. |
| X3 | REST routes, store, server Supabase client | Yes | DONE | Every documented route hit with curl and response keys/status checked against the contract; real DB used. Concurrent reset/write race remains a stress-case limitation below. |
| X4 | approved post-back, Discord REST, ICS routes | Yes | DONE | Pending post rejected with 409; browser approval delivered a real reply to its human source; calendar downloaded/opened and parsed. |
| X5 | integration, CI, smoke, deployment | Yes | PARTIAL | Integrated main, real-HTTP smoke green, public repository submission checked. Vercel deployment not performed because localhost was requested; hosted bot deployment not verified. |

## Live checks and screenshot evidence

Paths below are relative to the repository root. No unexecuted check is labelled PASS.

| Live check | Result | Evidence screenshot / detail |
|---|---|---|
| Human posts messy Discord commitment; bot listener ingests it | PASS | qa-screenshots/discord-human-message.png; bot-live-final.log |
| Real model returns strict schema-valid JSON | PASS | qa-screenshots/evidence-contracts.png; extraction-live.json records provider HTTP 200 and schemaValid=true |
| Demo board receives actual websocket insert with no refresh | PASS | qa-screenshots/realtime-no-refresh.png; realtime.json: zero navigations, one postgres insert frame |
| Private board receives a new card with no refresh | PASS | qa-screenshots/private-board-reconciliation.png; 5.35 s through REST reconciliation, zero navigations |
| Ingest-to-card p50 under three seconds | FAIL | qa-screenshots/evidence-latency.png; five API-only samples median 3.18 s, range 2.70–6.21 s, before rendering delay |
| Source message and context in review | PASS | qa-screenshots/human-review-source.png |
| Explicit approval dialog | PASS | qa-screenshots/human-approval-dialog.png |
| Browser approval delivers real Discord reply | PASS | qa-screenshots/human-approved-posted.png and discord-digest-public-and-human-reply.png; real Discord response 200 |
| Server refuses post without approval | PASS | qa-screenshots/api-post-without-approval.png; HTTP 409 |
| Event .ics downloads and opens | PASS | qa-screenshots/e2e-ics-download.png, e2e-valid-ics-open.png |
| Calendar contains correct London start/end across BST change | PASS | qa-screenshots/evidence-calendar.png; independent ical.js parser: 28 Oct 2026 18:30–21:00 Europe/London |
| Low-confidence mic request enters failure log | PASS | qa-screenshots/e2e-live-failure-log.png; confidence 0.45 |
| Browser Claim persists and names claimant | PASS | qa-screenshots/e2e-claimed.png |
| R reassigns owner to Sam | PASS | qa-screenshots/review-reassign-dialog.png, review-reassigned.png |
| E edits title and saves | PASS | qa-screenshots/review-edit-drawer.png, review-edited.png |
| J/K selection and X reject | PASS | qa-screenshots/review-next-j.png, review-previous-k.png, review-rejected.png |
| Live digest screen | PASS | qa-screenshots/e2e-live-digest.png |
| Real-community digest while simulator offline flag is 1 | PASS | qa-screenshots/live-digest-with-offline-simulator-flag.png; actual API statistics, no sample data |
| Real digest API unavailable (intentional browser network fault) | PASS | qa-screenshots/digest-real-api-unavailable.png; honest error, no fixtures, posting disabled |
| Copy digest markdown | PASS | qa-screenshots/digest-copied.png; clipboard text inspected |
| Web digest confirmation and demo post | PASS | qa-screenshots/digest-post-confirmation.png, digest-posted.png |
| /digest private response and approved public summary in Discord | PASS | qa-screenshots/discord-digest-private.png, discord-digest-public-and-human-reply.png; one initial Discord timeout required retry |
| Normal simulator: all 30 messages, animations, pause/resume | PASS | qa-screenshots/normal-playing.png, normal-paused.png, normal-complete.png; 76.161 s at 1x, live pipeline, 22 cards and one failure |
| Offline simulator: build flag 1, unreachable model, browser networking disabled | PASS | qa-screenshots/offline-playing.png, offline-complete.png; 73.739 s at 1x, 30/30, 22 cards and one failure |
| Inline simulator approve and simulated post | PASS | qa-screenshots/normal-approve.png, normal-post.png, offline-approve.png, offline-post.png |
| Offline calendar export/download/open | PASS | qa-screenshots/offline-export-download.png, offline-export-open.png |
| Landing at 1280×800 / 390 px | PASS | qa-screenshots/landing-1280.png, landing-390.png |
| Board at 1280×800 / 390 px | PASS | qa-screenshots/board-1280.png, board-390.png |
| Review at 1280×800 / 390 px | PASS | qa-screenshots/review-1280.png, review-390.png; mobile focus/actions sit below the queue |
| Failure log at 1280×800 / 390 px | PASS | qa-screenshots/failures-1280.png, failures-390.png; internal table scroll remains necessary to reach Claim |
| Digest at 1280×800 / 390 px | PASS | qa-screenshots/digest-1280.png, digest-390.png |
| Simulator at 1280×800 / 390 px | PASS | qa-screenshots/simulator-1280.png, simulator-390.png |
| Reduced-motion preference | PASS | qa-screenshots/review-reduced-motion.png; CSS and Framer reduced-motion paths checked |
| All final page responses under two seconds | PASS | qa-screenshots/simulator-load-after-cache.png; final 12-screen sweep max 472 ms; prior 4.44 s stall fixed |
| No private credentials in browser bundles | PASS | 78 client assets scanned; zero service-role, model, bot or ingest credential matches; browser-secrets.json |
| Lighthouse accessibility at least 90 | PASS | lighthouse-final.json: 100/100; earlier redesign run was 96 before final style fixes |
| Latest live-community navigation preserves correct community | PASS | qa-screenshots/live-community-navigation.png, simulator-navigation-context.png |
| Five tables, RLS, enums, publication and trigger in actual database | PASS | qa-screenshots/evidence-database.png; database-contract.json, schema-after.json |
| Fresh local Supabase db reset | FAIL — blocked | qa-screenshots/evidence-blocked.png; actual Docker daemon error captured. Hosted migrations succeeded. |
| CI smoke portability regression | PASS locally | qa-screenshots/evidence-ci.png; smoke-ci-final.log and ci-alias-typecheck.log; published GitHub checks available under repository Actions |
| Final workspace install/typecheck/lint/build/core tests | PASS | qa-screenshots/evidence-builds.png; detailed logs listed below |
| All documented REST response shapes | PASS | qa-screenshots/evidence-contracts.png and individual api-*.png |
| Public repo, licence, README, env and history scan | PASS | qa-screenshots/submission-public-repository.png and evidence-submission.png; anonymous GitHub HTTP 200, public main verified; no configured credentials found in reachable history |
| G2 extraction evaluation | PASS | qa-screenshots/evidence-eval.png |

### REST contract, actual curl results

| Route / case | Observed | Screenshot |
|---|---|---|
| GET /api/health | 200; ok=true, llm=true, db=true | api-health.png |
| POST /api/ingest | 201; messageId/items/failures | api-ingest-messy.png |
| POST /api/ingest without secret | 401 | api-ingest-unauthenticated.png |
| GET /api/items and status/type filters | 200; items array | api-items.png, api-items-filtered.png |
| PATCH /api/items/:id | 200; item | api-approve.png |
| POST /api/items/:id/post before approval | 409 | api-post-without-approval.png |
| POST /api/items/:id/post after approval | 200; posted/text | api-post.png |
| GET /api/items/:id/ics | 200; text/calendar and VCALENDAR | api-ics.png |
| GET /api/failures | 200; failures array | api-failures.png |
| POST /api/failures/:id/claim | 200; failure | api-claim.png |
| GET /api/digest | 200; generatedAt/open/overdue/unansweredQuestions/decisions/stats | api-digest.png |
| POST /api/simulator/reset | 200; ok=true; demo only | api-reset.png |

### Builds, errors and verification limits

Workspace installation completed successfully using the frozen pnpm lockfile (10.8 s). Web: TypeScript, ESLint and optimized production build passed; bot: TypeScript/lint/build passed; core: TypeScript/lint/build and **205 tests passed**. API approval/calendar/digest Node tests and the approval-gate suite passed; the final digest posting regression suite passed all 15 tests. X5 smoke was run with SMOKE_HTTP=1 against real services and ended **smoke green**, not the default stubs.

Final successful logs: build-final-nav.log, build-final-offline-nav.log, build-live-digest-fix.log, build-final-offline.log, build-final-live.log, web-typecheck-redesign-final.log, web-lint-redesign-final.log, bot-lint-redesign-final.log, bot-build-redesign-final.log, core-build-redesign-final.log, core-tests-dst.log, api-tests-final.log, smoke-live-final.log, install-ci.log.

Errors encountered earlier, with their actual locations rather than invented source lines:

- apps/web/app/api/_lib/store.ts:15 — GitHub smoke could not resolve the Next-only @/lib/db alias. Fixed with a relative import; pnpm smoke and web typecheck pass. GitHub check history is linked from the public repository Actions page.
- packages/core/src/index.ts:25 — TS2307 / unresolved ./ranker; affected all three packages. Restored the existing C10 implementation.
- apps/web/app/layout.ts — build-time Google font requests failed DNS for Inter, Space Grotesk and JetBrains Mono. Replaced remote font loading with bundled fonts; final Geist redesign is bundled too. This was a network build error, not a TypeScript source error with a reported line.
- Temporary web build runtime could not resolve React after dependency replacement; reinstall/runtime resolution restored. The log reported no application file/line.
- Concurrent Next dev/build output caused PageNotFoundError for /api/ingest during page-data collection (Next internal require.js:94, utils.js:1269). Isolated build output and clean isolated checkout builds pass; no source route was missing.
- Transient incomplete redesign edits failed while another process was writing them. Final committed redesign typecheck/build passes; those intermediate generated-output failures are retained in the local logs.

Browser network records are preserved in browser-visual.json, browser-flow.json and both rehearsal JSON files. Final responsive checks had no uncaught application exceptions or HTTP failures. Next Link background RSC prefetches were cancelled on navigation (net::ERR_ABORTED); calendar downloads also produce a normal navigation-aborted event. An earlier blank evidence-page favicon request returned 404; the application now supplies icon.svg. A real Discord REST attempt timed out once and succeeded on retry. The five-request latency test initially overlapped a simulator reset and exposed an item_events foreign-key error; it was rerun in a separate community, with five successful results. That reset/write race is retained below rather than hidden.

### G2 live extraction results

Model: gpt-4o-mini, 60 cases. Type accuracy **98.33%**, named-owner micro F1 **0.9333** (precision 1.0, recall 0.875), priority within one level **100%**. No extraction failures. Named owners occur in the task cases, so other categories do not have a meaningful named-owner F1.

| Expected category | Type accuracy | Priority within one | Named-owner F1 |
|---|---|---|---|
| Request | 10/10, 100% | 100% | N/A |
| Task | 9/10, 90% | 100% | 0.9333 |
| Event | 10/10, 100% | 100% | N/A |
| Question | 10/10, 100% | 100% | N/A |
| Decision | 10/10, 100% | 100% | N/A |
| Noise | 10/10, 100% | 100% | N/A |

Publication verified: https://github.com/aimmatrix/clerk is public, main is pushed, anonymous HTTP 200. Pattern scans found one literal smoke-service-key fixture (scripts/smoke.ts:50), not a credential; an exact scan of the configured credentials across reachable historical blobs found zero matches.

Only miss: g2-018, expected Ana-owned task, classified as a decision without owner.

The digest originally returned after the two-second UI timeout on one private-community check (2.61 s). Parallel independent DB reads subsequently returned 0.157, 0.130 and 0.268 s with real curl; the UI now allows a slower real response without substituting demo statistics.

The evaluation predates the DST-only normalization fix; category/owner logic was unchanged by that fix.

## Blockers fixed and commits

| Commit | Fix |
|---|---|
| 4261c4d | Restore existing missing C10 ranker and its tests. |
| 936f600 | Integrate task files and real shared core/API/DB/realtime; remove stale mock wiring; prevent cached empty API reads; keep service/ingest secrets out of browser; restrict reset to demo; bundle fonts and repair setup/env links. |
| 14d5be4 | Integrate the complete implementation tree with main's scaffold ancestry. |
| 210aebf | Wait for every simulator extraction result before marking playback complete. |
| 6ed2fd5 | Completed user-requested light UI redesign, subsequently QA checked. |
| 3d56d2e | Correct London DST offsets, restore private-board REST reconciliation, stabilize ambiguous mic demo beat; add regression coverage. |
| 2945db6 | Fix actual mobile document overflow from failure-table accessibility text. |
| d799576 | Restore explicit simulated-chat demo label. |
| d955b78 | Allow separate Next demo/build output directories and document environment setting. |
| 8d7ca80 | Remove inaccurate sixty-second marketing promise after timing playback. |
| b465f8d | Preserve live community in Board/Review/Digest/Failures and demo community when leaving simulator; verified new navigation. |
| 2e73376 | Keep real digests live even with simulator offline mode; restrict fixtures to demo, show honest errors, parallelize independent DB reads. Live digest curls: 0.13–0.27 s after the fix. |
| 895d74d | Cache navigation metadata for 60 seconds and bound its wait to 1.5 seconds; fix an observed 4.44-second page stall. Three mobile simulator loads reached Play in 187, 44 and 38 ms. |
| 56dd3b6 | Fix CI smoke importing the API store outside Next: use the equivalent relative mapper import. Web typecheck and the actual default CI smoke pass. |

Database work applied the existing two migrations and seed to the configured project and repaired their migration-history entries, preserving unrelated pre-existing migrations. No new product feature or unrelated schema was introduced.

## Remaining issues, ranked by demo impact

| Impact | File / area | Issue | Quickest action |
|---|---|---|---|
| High | packages/core/src/extractor.ts:185 and apps/web/app/api/ingest/route.ts:42 | Real provider/API median 3.18 s before browser delivery, over PRD's 3 s target; one sample 6.21 s. Discord also had a transient network timeout. | Present the cached simulator on stage; keep real Discord segment short with the already-observed flow and recording fallback. Model/network tuning needs a new measurement, not a promise. |
| Low | docs/pitch.md:11 | Spoken narration was not timed; the required full simulator playback passed in both modes. Real Discord actions were tested separately. | Rehearse the spoken pitch once at 2x before presenting. |
| Medium | apps/web/lib/realtime.ts:125; supabase owner RLS | Private anonymous browser subscribes but receives no private postgres changes. REST reconciliation now works; demo websocket delivery is genuine. | Use demo community for stage; owner authentication is needed for true private websocket delivery. Keep existing RLS. |
| Medium | apps/web/app/api/ingest/route.ts:59; app/api/_lib/store.ts; app/api/simulator/reset/route.ts:16 | Reset concurrent with ingestion can delete an item between item insertion and item_events insertion, producing a foreign-key error. Observed during deliberately overlapping QA operations. | Reset only while idle for the demo; serialize or transactionally group persistence/reset before a multi-user pilot. |
| Medium | supabase/config.toml | A fresh local db reset was not run because Docker is stopped. Hosted migration application and resulting schema were verified. | Start Docker and run supabase db reset when there is time; preserve the working hosted database for the demo. |
| Medium | vercel.json / X5 deployment | No deployed web URL was tested or created; user requested localhost. Bot is verified locally. | Use the laptop for the demo and submit the public repo plus recording. Deploy separately if a public interactive URL is required. |
| Low | components/clerk/brand/site-nav.tsx:37; review-workspace.tsx:119; failures-log.tsx:172 | At 390 px the nav and failure table scroll horizontally; Review's focus/actions sit below a long queue. No document overflow remains, but these controls require scrolling. | Use 1280×800 for presentation; add mobile scroll hints or focus-first ordering after freeze. |
| Pilot/security | app/api/items/route.ts and item mutation routes | Service-backed dashboard routes do not establish an owner authentication boundary. Localhost demo works; DB RLS alone does not protect service-role REST handlers. | Keep this demo local; add authenticated ownership checks before exposing private community data in a production deployment. |

## Three actions before 21:50 London

1. Rehearse the spoken pitch once at 2x using the offline simulator; keep the downloaded calendar and recorded GIF ready.
2. Test one fresh human Discord commitment and /digest immediately before presenting; fall back to the labelled simulator after five seconds of delay.
3. Freeze the verified main commit, submit the public repository and recording, and avoid further design changes or demo resets while extraction is in flight.

Final release verification: 12/12 desktop/mobile screens returned HTTP 200, no document overflow, no uncaught app errors or failed HTTP responses; maximum page-response time 472 ms. Background RSC prefetch cancellation events remain recorded separately. The last full offline playback took 73.739 seconds.
