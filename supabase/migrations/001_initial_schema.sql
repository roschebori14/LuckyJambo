-- Lucky Jambo Initial Schema
-- Phase 2A

create extension if not exists "uuid-ossp";

-- =========================
-- PROFILES
-- =========================

create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    email text unique not null,

    username text unique not null,

    full_name text,

    avatar_url text,

    phone text,

    country text default 'Cameroon',

    is_verified boolean default false,

    is_banned boolean default false,

    role text default 'user'
    check (role in ('user','admin')),

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

create index idx_profiles_email
on profiles(email);

create index idx_profiles_username
on profiles(username);

-- =========================
-- WALLETS
-- =========================

create table wallets (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid not null references profiles(id) on delete cascade,

    available_balance numeric(12,2) default 0,

    locked_balance numeric(12,2) default 0,

    created_at timestamptz default now(),

    updated_at timestamptz default now(),

    unique(user_id)
);

create index idx_wallets_user
on wallets(user_id);

-- =========================
-- WALLET LEDGER
-- =========================

create table wallet_ledger (

    id uuid primary key default uuid_generate_v4(),

    wallet_id uuid not null references wallets(id),

    user_id uuid not null references profiles(id),

    type text not null
    check (
        type in (
            'deposit',
            'withdrawal',
            'match_stake',
            'match_win',
            'match_loss',
            'refund',
            'bonus',
            'admin_adjustment'
        )
    ),

    amount numeric(12,2) not null,

    balance_before numeric(12,2) not null,

    balance_after numeric(12,2) not null,

    reference text,

    description text,

    created_at timestamptz default now()
);

create index idx_wallet_ledger_user
on wallet_ledger(user_id);

-- =========================
-- DEPOSITS
-- =========================

create table deposits (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid references profiles(id),

    amount numeric(12,2) not null,

    provider text default 'fapshi',

    transaction_reference text unique,

    status text default 'pending'
    check (
        status in (
            'pending',
            'completed',
            'failed'
        )
    ),

    created_at timestamptz default now()
);

-- =========================
-- WITHDRAWALS
-- =========================

create table withdrawals (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid references profiles(id),

    amount numeric(12,2) not null,

    account_number text,

    provider text,

    transaction_reference text,

    status text default 'pending'
    check (
        status in (
            'pending',
            'approved',
            'rejected',
            'failed',
            'completed'
        )
    ),

    created_at timestamptz default now()
);

-- =========================
-- TRANSACTIONS
-- =========================

create table transactions (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid references profiles(id),

    amount numeric(12,2),

    transaction_type text,

    reference text,

    status text,

    created_at timestamptz default now()
);

-- =========================
-- FRIEND REQUESTS
-- =========================

create table friend_requests (

    id uuid primary key default uuid_generate_v4(),

    sender_id uuid references profiles(id),

    receiver_id uuid references profiles(id),

    status text default 'pending'
    check (
        status in (
            'pending',
            'accepted',
            'rejected'
        )
    ),

    created_at timestamptz default now()
);

-- =========================
-- FRIENDS
-- =========================

create table friends (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid references profiles(id),

    friend_id uuid references profiles(id),

    created_at timestamptz default now()
);

-- =========================
-- GAMES
-- =========================

create table games (

    id uuid primary key default uuid_generate_v4(),

    name text unique not null,

    slug text unique not null,

    min_stake numeric(12,2) default 50,

    max_stake numeric(12,2) default 100000,

    is_active boolean default true,

    created_at timestamptz default now()
);

-- =========================
-- MATCHES
-- =========================

create table matches (

    id uuid primary key default uuid_generate_v4(),

    game_id uuid references games(id),

    stake_amount numeric(12,2),

    total_pot numeric(12,2),

    winner_id uuid references profiles(id),

    status text default 'waiting'
    check (
        status in (
            'waiting',
            'active',
            'completed',
            'cancelled'
        )
    ),

    created_at timestamptz default now()
);

-- =========================
-- MATCH PARTICIPANTS
-- =========================

create table match_participants (

    id uuid primary key default uuid_generate_v4(),

    match_id uuid references matches(id),

    user_id uuid references profiles(id),

    joined_at timestamptz default now()
);

-- =========================
-- NOTIFICATIONS
-- =========================

create table notifications (

    id uuid primary key default uuid_generate_v4(),

    user_id uuid references profiles(id),

    title text,

    message text,

    is_read boolean default false,

    created_at timestamptz default now()
);

-- =========================
-- REPORTS
-- =========================

create table reports (

    id uuid primary key default uuid_generate_v4(),

    reporter_id uuid references profiles(id),

    reported_user_id uuid references profiles(id),

    reason text,

    status text default 'open',

    created_at timestamptz default now()
);

-- =========================
-- ADMIN LOGS
-- =========================

create table admin_logs (

    id uuid primary key default uuid_generate_v4(),

    admin_id uuid references profiles(id),

    action text,

    details jsonb,

    created_at timestamptz default now()
);

-- =========================
-- SETTINGS
-- =========================

create table settings (

    id uuid primary key default uuid_generate_v4(),

    key text unique,

    value text,

    created_at timestamptz default now()
);