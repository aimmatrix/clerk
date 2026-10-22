# Self-hosting

Clerk has three runtime pieces: the web app (and API), the Discord bot, and a Supabase project.

## Web app

Any Node 20 host works. For Vercel:

1. Import the repository and set the root directory to `apps/web` (or use the repo's `vercel.json` if present).
2. Add the environment variables from `.env.example` in the dashboard. Set `CLERK_API_URL` to the deployed URL.
3. Deploy. Check `/api/health` returns `{"ok":true,"llm":true,"db":true}`.

Keep `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `LLM_API_KEY` and `INGEST_SECRET` as server-side variables. Only variables prefixed `NEXT_PUBLIC_` reach the browser.

## Discord bot

The bot is a long-running Node process. Run it anywhere that stays up: Railway, Fly.io, a small VPS, or a spare laptop.

```bash
pnpm --filter bot build   # if a build step exists
pnpm --filter bot start
```

It needs `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID`, `CLERK_API_URL` and `INGEST_SECRET`. The `INGEST_SECRET` must match the web app's value.

The bot never posts approved items itself. The web app posts through the Discord REST API using `DISCORD_BOT_TOKEN`, so the bot does not need to expose an HTTP port.

## Supabase

- Apply `supabase/migrations/` in order.
- Realtime must be enabled for `items`, `failures` and `messages`.
- Row-level security is on for every table. The service role (used by the API) bypasses it; the browser uses the anon key and is limited to what the policies allow.

## Upgrading

Pull the latest changes, run `pnpm install`, apply any new migrations, redeploy the web app, restart the bot.

## Backups

Use Supabase's built-in backups, or `pg_dump` against your project's connection string.
