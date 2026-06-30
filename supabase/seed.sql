-- ==========================================
-- LUCKY JAMBO SEED DATA
-- ==========================================

-- GAMES

insert into games (
    name,
    slug,
    min_stake,
    max_stake,
    is_active
)
values
(
    'Chess',
    'chess',
    50,
    100000,
    true
),
(
    'Draughts',
    'draughts',
    50,
    100000,
    true
),
(
    'Tic Tac Toe',
    'tic-tac-toe',
    50,
    100000,
    true
),
(
    'Dice',
    'dice',
    50,
    100000,
    true
);

-- PLATFORM SETTINGS

insert into settings (
    key,
    value
)
values
(
    'platform_name',
    'Lucky Jambo'
),
(
    'platform_fee_percent',
    '5'
),
(
    'minimum_deposit',
    '50'
),
(
    'maximum_deposit',
    '100000'
),
(
    'minimum_withdrawal',
    '500'
),
(
    'maximum_withdrawal',
    '100000'
),
(
    'maintenance_mode',
    'false'
),
(
    'allow_public_matches',
    'true'
),
(
    'allow_friend_matches',
    'true'
);

-- SAMPLE NOTIFICATION TEMPLATE

insert into settings (
    key,
    value
)
values
(
    'welcome_message',
    'Welcome to Lucky Jambo. Challenge friends and win rewards through skill-based gaming.'
);

-- OPTIONAL TEST ADMIN
-- Replace UUID with actual admin user ID after registration

-- update profiles
-- set role = 'admin'
-- where id = 'YOUR_ADMIN_UUID_HERE';
-- BONUS GAMES (added in Phase 7 - engines implemented)
-- Uses ON CONFLICT DO NOTHING so safe to re-run

insert into games (name, slug, min_stake, max_stake, is_active)
values
  ('Rock Paper Scissors', 'rock_paper_scissors', 50, 50000, true),
  ('Coin Flip',           'coin_flip',           50, 50000, true)
on conflict (slug) do nothing;
