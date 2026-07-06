-- Lucky Jambo - Normalize games.slug (fix: Tic Tac Toe card image)
--
-- WHAT WAS CHECKED
-- Every code path that renders a game's thumbnail was traced end to
-- end and re-tested against a real Postgres instance running the full
-- migration chain + a real Next.js dev server:
--   - components/games/game-card.tsx and app/(protected)/games/[id]/
--     page.tsx both build the image src as literally
--     `/images/${slug}.png`, where `slug` comes straight from the
--     `games` row (games.slug for the card, the route param for the
--     lobby header - same value either way).
--   - public/images/tic-tac-toe.png exists, is a valid 1024x1024 PNG,
--     and serves correctly (200, correct content-type) - confirmed
--     directly against a running dev server, not just "the file is
--     there".
--   - supabase/seed.sql seeds this row as
--     ('Tic Tac Toe', 'tic-tac-toe', ...) - slug matches the filename
--     exactly, and no migration or admin tool ever touches this row
--     afterwards (there's no admin "edit game" UI at all - `games` is
--     only ever written by seed.sql and the battleship/snakes-ladders/
--     four-in-a-row/dots-and-boxes migrations' own inserts, none of
--     which touch the tic-tac-toe row).
--
-- So the code as it stands is correct for a freshly-seeded database.
-- The one thing that can't be verified from the repo alone is what
-- games.slug actually holds in production right now - this project
-- has hit exactly this class of bug before (033_normalize_username_
-- spaces.sql, for stray whitespace ending up in `profiles.username`
-- via a manual/ad-hoc path). Since the image lookup here is an exact,
-- case-sensitive string match against a filename, the tic-tac-toe
-- card can only fail to load if `games.slug` for that row is anything
-- other than precisely 'tic-tac-toe' right now in the live database -
-- e.g. trailing whitespace or different casing from a one-off SQL
-- editor edit, which this project has a documented history of doing
-- (see docs/... "multiple idempotent SQL patches applied directly in
-- the Supabase SQL editor").
--
-- THE FIX
--   1. Trim + lowercase every games.slug and trim every games.name.
--      Whatever 'tic-tac-toe' currently holds in production - trailing
--      whitespace, different casing, anything - this forces it back
--      to exactly what the filename and the app's own routing expect,
--      without needing to special-case that one row (any other game
--      that's drifted the same way gets fixed too, for free).
--   2. A trigger so this can't silently drift again from a future
--      manual edit, mirroring 033's approach for usernames.
--
-- This is deliberately narrow: only slug/name whitespace+case are
-- touched, nothing else about any game row changes.

update games
set slug = trim(lower(slug)),
    name = trim(name);

create or replace function public.normalize_game_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is not null then
    new.slug := trim(lower(new.slug));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_games_normalize_slug on games;
create trigger trg_games_normalize_slug
before insert or update of slug on games
for each row
execute function public.normalize_game_slug();
