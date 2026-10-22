-- Clerk demo seed. Runs after migrations on `supabase db reset`.
-- Safe to run repeatedly. Creates only the public demo community; the
-- simulator streams demo/seed/london-meetup.json through /api/ingest
-- (source = 'simulator'), so no messages or items are pre-inserted.
--
-- The id must match DEMO_COMMUNITY_ID in packages/core and the "demo read"
-- RLS policies in 0001_init.sql.

insert into communities (id, name, discord_guild_id, post_channel_id, owner_user_id)
values (
  '00000000-0000-0000-0000-000000000001',
  'Shoreditch Builders (Demo)',
  null,
  null,
  null
)
on conflict (id) do update
  set name = excluded.name;
