-- Lucky Jambo - Live gameplay updates via Realtime
--
-- Every board (chess, tic-tac-toe, draughts, battleship, instant games)
-- and the "waiting for opponent" screen currently only ever learn about
-- a change (opponent joined, opponent moved, match settled) by polling
-- every 2-3 seconds. That works but means a real move can take up to a
-- few seconds to visibly land for the other player, and it's a lot of
-- wasted round trips.
--
-- This adds the `matches` table to Supabase's `supabase_realtime`
-- publication so clients can subscribe to postgres_changes on it. RLS
-- still fully applies to the replication stream - a client only
-- receives change events for rows their JWT is allowed to select under
-- the existing "view own matches" policy (005_fix_matches_schema.sql),
-- so an opponent can't snoop on someone else's match this way.
--
-- REPLICA IDENTITY FULL isn't strictly required for our filter (we
-- filter on `id`, the primary key, which is always present in the
-- default replica identity), but it's set anyway per Supabase's own
-- guidance so the old row is fully populated too, which keeps this
-- resilient if a future subscriber ever needs to diff old vs new.

alter table matches replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
