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

-- Keep items.updated_at honest on every write (API/bot/review actions all go through UPDATE).
create function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

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
