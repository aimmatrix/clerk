-- Per-community counters for the stats bar and /api/digest.
--
-- security_invoker: the view runs with the caller's privileges, so the RLS policies on
-- items/failures still apply. Without it the view would run as its owner and leak every
-- community's counts to anon. Consequence: anon sees only the demo community's row;
-- owners see their own. A community with no items or failures yet has no row (clients
-- treat a missing row as all zeros).
--
-- captured    = actionable items (everything except noise)
-- approved    = items a human has approved, whether since posted or done (hours-saved basis)
-- hours_saved = approved x 4 minutes / 60 (matches the stats bar definition)
create view item_stats
with (security_invoker = true)
as
with item_counts as (
  select
    community_id,
    count(*) filter (where type <> 'noise')                                   as captured,
    count(*) filter (where type = 'noise')                                    as noise,
    count(*) filter (where status = 'pending' and type <> 'noise')            as pending,
    count(*) filter (where status in ('approved','posted','done'))            as approved,
    count(*) filter (where status = 'posted')                                 as posted,
    count(*) filter (where status = 'done')                                   as done,
    count(*) filter (where status = 'rejected')                               as rejected
  from items
  group by community_id
),
failure_counts as (
  select community_id, count(*) as failures
  from failures
  group by community_id
)
select
  coalesce(i.community_id, f.community_id)               as community_id,
  coalesce(i.captured, 0)::int                           as captured,
  coalesce(i.noise, 0)::int                              as noise,
  coalesce(i.pending, 0)::int                            as pending,
  coalesce(i.approved, 0)::int                           as approved,
  coalesce(i.posted, 0)::int                             as posted,
  coalesce(i.done, 0)::int                               as done,
  coalesce(i.rejected, 0)::int                           as rejected,
  coalesce(f.failures, 0)::int                           as failures,
  round(coalesce(i.approved, 0) * 4 / 60.0, 2)::float8   as hours_saved
from item_counts i
full outer join failure_counts f using (community_id);

grant select on item_stats to anon, authenticated, service_role;
