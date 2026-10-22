# Contributing to Clerk

Thanks for helping. Clerk is MIT licensed and aims to be runnable by any community in under 15 minutes, so changes that make setup simpler or extraction more accurate are especially welcome.

## Getting set up

Requirements: Node 20 and pnpm.

```bash
git clone https://github.com/<your-org>/clerk.git
cd clerk
pnpm install
cp .env.example .env.local
pnpm --filter web dev
```

Set `NEXT_PUBLIC_SIMULATOR_OFFLINE=1` to work on the UI without Supabase, Discord or an LLM key.

## Repository layout

| Path | What lives there |
|---|---|
| `apps/web` | Next.js 14 app (board, review, failures, digest, simulator, API routes) |
| `apps/bot` | discord.js v14 bot |
| `packages/core` | `@clerk/core`: types, extractor, ranker, context, digest, ICS |
| `supabase` | SQL migrations and seed |
| `demo/seed` | Simulator script and evaluation set |
| `docs` | Guides |

## Before opening a pull request

```bash
pnpm typecheck
pnpm test
pnpm tsx demo/seed/eval/score.ts   # if you touched the prompt, schema or extractor
```

If your change affects extraction, include the eval output in the PR description. Type accuracy must stay at or above 85%.

## Conventions

- TypeScript strict. No `any` without a comment explaining why.
- Files are `kebab-case`, components `PascalCase`, TypeScript identifiers `camelCase`, SQL `snake_case`.
- UK English in all user-facing copy.
- Shared types live in `packages/core/src/types.ts`. Change them deliberately and update every consumer in the same PR.
- Database changes go in a new numbered migration; never edit one that has shipped.
- Small, focused commits with clear messages.

## Principles that must not regress

1. **Nothing is posted publicly without human approval.** Any path that posts to Discord must check that the item's status is `approved`.
2. **Failures are visible.** Low-confidence or unparseable output goes to the couldn't-handle log. It is never silently dropped.
3. **Owners are never invented.** An owner must appear in the message or its context; otherwise it is null.
4. **No secrets in the repo or the browser.** Use `.env.local`; the service-role key and Discord token stay server-side.

## Reporting bugs and requesting features

Use the issue templates. For bad extractions, include the message text (redact anything private), the context, what Clerk produced and what you expected. Never paste tokens or API keys.

## Security

If you find a vulnerability (for example a way to make Clerk post without approval, or to read another community's data), please do not open a public issue. Contact the maintainers privately.
