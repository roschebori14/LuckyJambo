-- Lucky Jambo - Fix leaderboard RLS blindness
--
-- The leaderboard page queried `matches` (for win counts) and
-- `wallet_ledger` (for total earnings) directly with the user's own
-- session client. Both tables have RLS scoped to the querying user
-- only ("view own matches": creator or participant; wallet_ledger:
-- auth.uid() = user_id) - so every visitor's "leaderboard" was
-- silently just a reflection of their own matches/earnings, never
-- other players'. It rendered without error, which is exactly the
-- kind of bug that's easy to miss without checking as two different
-- users.
--
-- Fix: two SECURITY DEFINER, read-only aggregate functions that only
-- return a username + an aggregate number (no stakes, no wallet
-- balances, no match ids) - safe to expose across users - and the
-- leaderboard page now calls these via rpc() instead of querying the
-- underlying tables directly.

create or replace function public.get_leaderboard_wins(p_limit int default 20)
returns table (user_id uuid, username text, wins bigint)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, count(*)::bigint as wins
  from matches m
  join profiles p on p.id = m.winner_id
  where m.status = 'completed' and m.winner_id is not null
  group by p.id, p.username
  order by wins desc, p.username asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_leaderboard_wins(int) to authenticated;

create or replace function public.get_leaderboard_earners(p_limit int default 20)
returns table (user_id uuid, username text, earned numeric)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, coalesce(sum(wl.amount), 0) as earned
  from wallet_ledger wl
  join profiles p on p.id = wl.user_id
  where wl.type = 'match_win'
  group by p.id, p.username
  order by earned desc, p.username asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_leaderboard_earners(int) to authenticated;
