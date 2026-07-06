-- Lucky Jambo - Fix `games.type` schema drift (blocks word-chain insert)
--
-- WHAT HAPPENED
-- 053_word_chain.sql's closing `insert into games (name, slug, min_stake,
-- max_stake, is_active) ... on conflict (slug) do nothing;` fails with:
--   null value in column "type" of relation "games" violates
--   not-null constraint
-- but no migration in this repo - including 001_initial_schema.sql and
-- supabase/seed.sql - ever defines a `type` column on `games`, and no
-- app code reads one (game-card.tsx and app/page.tsx both classify
-- Instant vs Turn-based from their own hardcoded maps, not the DB).
-- The failing row Postgres reports has more fields than this repo's
-- tracked schema accounts for, which means `type` (and at least one
-- more column) was added straight in the Supabase SQL editor at some
-- point and never captured in a migration - the same class of drift
-- 052_normalize_game_slugs.sql already had to correct once for
-- `games.slug`/`games.name`.
--
-- THE FIX
-- Give the drifted column a safe default so it can never again block
-- an insert from this migration chain, backfill any existing null
-- rows, and only then (re)insert the word-chain row. Guarded with
-- `information_schema` / `column_default` checks so this migration is
-- a no-op (and safe to re-run) on any environment where `type`
-- doesn't exist or already has a default.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'type'
  ) then
    -- Backfill existing rows first (min_stake alone can't tell us
    -- Instant vs Turn-based, so default everything to the more common
    -- 'Turn-based' and let the one-off SQL-editor process that added
    -- this column in the first place correct any Instant games by hand -
    -- safer than guessing per-slug here).
    update games set type = 'Turn-based' where type is null;

    alter table games alter column type set default 'Turn-based';
    alter table games alter column type set not null;
  end if;
end $$;

-- Now safe to (re)run the insert 053 was attempting.
insert into games (name, slug, min_stake, max_stake, is_active)
values ('Word Chain', 'word-chain', 50, 100000, true)
on conflict (slug) do nothing;
