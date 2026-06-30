-- Lucky Jambo - AI assistant usage log
--
-- Used for two things:
--   1. Rate limiting - prevents a single user from hammering the Groq
--      API (and running up costs) via the support chat endpoint.
--   2. A lightweight audit trail - if a user reports the assistant
--      said something wrong, admins can see what was actually sent.
--
-- Not storing full conversation content long-term by default - just
-- enough to rate-limit and spot-check. message_preview is truncated
-- in the application layer before insert.

create table if not exists ai_chat_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references profiles(id) on delete cascade,
    assistant_type text not null check (assistant_type in ('support', 'admin_analyst')),
    message_preview text,
    created_at timestamptz default now()
);

create index if not exists idx_ai_chat_logs_user_time on ai_chat_logs(user_id, created_at);

alter table ai_chat_logs enable row level security;

-- Users can see their own chat log entries (for transparency)
create policy "view own ai chat logs"
on ai_chat_logs
for select
using (auth.uid() = user_id);

-- Only the server (service role / security definer functions) inserts rows.
-- No insert policy for regular users - the API route uses the server
-- client which is subject to RLS, so we need a permissive insert policy
-- scoped to the user only inserting their own rows.
create policy "insert own ai chat logs"
on ai_chat_logs
for insert
with check (auth.uid() = user_id);

-- Admins can view all logs (uses the same is_admin() helper pattern
-- as the rest of the admin RLS policies, defined in 002_rls_policies.sql)
create policy "admins view all ai chat logs"
on ai_chat_logs
for select
using (
  exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
);
