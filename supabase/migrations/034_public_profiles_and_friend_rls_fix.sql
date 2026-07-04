-- Lucky Jambo - Public profile viewing + fix RLS blindness across the
-- friends feature.
--
-- Background: migration 002 scopes `profiles` SELECT to
-- `auth.uid() = id` (plus a full-access policy for admins). That's
-- correct for protecting email/phone/role, but it also silently
-- breaks every existing feature that needs to show *another* user's
-- basic info, because RLS filters rows, not columns - there's no way
-- to write a permissive-but-safe policy directly on the table:
--   - friend-service getFriends()/getRequests(): the embedded
--     `profiles!friends_friend_id_fkey(...)` / `...sender_id_fkey(...)`
--     joins come back null for every row, since the joined profile
--     row belongs to someone other than the caller.
--   - friend-service searchByUsername(): the add-friend search always
--     returns zero rows for anyone but yourself.
--   - friend-service resolveInviteCode(): invite links resolve to
--     nothing, so the invite landing page always renders "invalid".
--   - the matches page's batch creator-username lookup: every open
--     match shows "Player" instead of the real creator name.
-- None of these error out - they just quietly return empty/null,
-- which is exactly why it went unnoticed (the same pattern migration
-- 031 fixed for the leaderboard).
--
-- Fix: SECURITY DEFINER, read-only functions (same pattern as 031)
-- that return only a curated, safe set of columns - never email,
-- phone, is_banned, or invite_code - regardless of who's asking.
-- Application code now calls these via rpc() instead of querying
-- `profiles` directly for anyone but the current user.

-- =========================
-- profiles.bio was referenced by the profile edit form and
-- ProfileService.update() since that feature shipped, but the column
-- itself was never added - every bio save has been failing. Adding it
-- now also makes it available on the new public profile view.
-- =========================
alter table profiles
add column if not exists bio text
check (char_length(bio) <= 280);

-- =========================
-- Single profile lookup by username, with match stats, for the new
-- /profile/[username] page. Deliberately excludes email, phone,
-- is_banned, and invite_code.
-- =========================
create or replace function public.get_public_profile(p_username text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  bio text,
  country text,
  role text,
  is_verified boolean,
  created_at timestamptz,
  wins bigint,
  losses bigint,
  matches_played bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    p.bio,
    p.country,
    p.role,
    p.is_verified,
    p.created_at,
    coalesce(w.wins, 0) as wins,
    coalesce(l.losses, 0) as losses,
    coalesce(w.wins, 0) + coalesce(l.losses, 0) as matches_played
  from profiles p
  left join (
    select winner_id, count(*)::bigint as wins
    from matches
    where status = 'completed' and winner_id is not null
    group by winner_id
  ) w on w.winner_id = p.id
  left join (
    select mp.user_id, count(*)::bigint as losses
    from match_participants mp
    join matches m on m.id = mp.match_id
    where m.status = 'completed'
      and m.winner_id is not null
      and mp.user_id <> m.winner_id
    group by mp.user_id
  ) l on l.user_id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to authenticated;

-- =========================
-- Batch lookup by id - powers friend-list and friend-request-sender
-- embeds without relying on PostgREST FK embedding (which doesn't
-- work against RLS-restricted rows anyway).
-- =========================
create or replace function public.get_public_profiles_by_ids(p_ids uuid[])
returns table (
  id uuid,
  username text,
  avatar_url text,
  is_verified boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.avatar_url, p.is_verified
  from profiles p
  where p.id = any(p_ids);
$$;

grant execute on function public.get_public_profiles_by_ids(uuid[]) to authenticated;

-- =========================
-- Username search for "add friend", excluding the searcher.
-- =========================
create or replace function public.search_public_profiles(
  p_query text,
  p_exclude_id uuid,
  p_limit int default 8
)
returns table (
  id uuid,
  username text,
  avatar_url text,
  is_verified boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.avatar_url, p.is_verified
  from profiles p
  where p.username ilike '%' || p_query || '%'
    and p.id <> p_exclude_id
  order by p.username asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.search_public_profiles(text, uuid, int) to authenticated;

-- =========================
-- Invite code resolution for the invite landing page.
-- =========================
create or replace function public.resolve_invite_code(p_code text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  is_verified boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.avatar_url, p.is_verified
  from profiles p
  where p.invite_code = p_code
  limit 1;
$$;

grant execute on function public.resolve_invite_code(text) to authenticated;
