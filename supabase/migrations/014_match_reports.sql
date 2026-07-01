-- Lucky Jambo - Match dispute/report system
--
-- Players had no way to flag a problem match (desync, suspected
-- cheating, opponent vanished but forfeit timeout hasn't hit yet).
-- This adds a report queue the admin panel can review and resolve by
-- either refunding both stakes or dismissing the report.

create table if not exists match_reports (
    id uuid primary key default uuid_generate_v4(),
    match_id uuid references matches(id) on delete cascade not null,
    reporter_id uuid references profiles(id) not null,
    reason text not null,
    status text default 'pending' check (status in ('pending', 'resolved_refund', 'dismissed')),
    admin_notes text,
    resolved_by uuid references profiles(id),
    resolved_at timestamptz,
    created_at timestamptz default now()
);

create index if not exists idx_match_reports_status on match_reports(status);

alter table match_reports enable row level security;

create policy "view own reports"
on match_reports
for select
using (auth.uid() = reporter_id);

create policy "create own reports"
on match_reports
for insert
with check (auth.uid() = reporter_id);

create policy "admins view all reports"
on match_reports
for select
using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "admins update reports"
on match_reports
for update
using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Only one open report per match per reporter - stops accidental
-- double-submits from the UI from cluttering the admin queue.
create unique index if not exists idx_match_reports_unique_pending
on match_reports(match_id, reporter_id)
where status = 'pending';

-- Admin resolution RPC: refunds both participants' locked stakes and
-- marks the match cancelled. Only callable by an admin (checked via
-- the profiles.role lookup, same pattern as the rest of the schema).
create or replace function public.resolve_match_report(
  p_report_id uuid,
  p_action text, -- 'refund' or 'dismiss'
  p_admin_notes text default null
)
returns match_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report match_reports%rowtype;
  v_match matches%rowtype;
  v_participants uuid[];
  v_is_admin boolean;
begin
  select (role = 'admin') into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Admin access required';
  end if;

  if p_action not in ('refund', 'dismiss') then
    raise exception 'Invalid action';
  end if;

  select * into v_report from match_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if v_report.status != 'pending' then raise exception 'Report already resolved'; end if;

  if p_action = 'refund' then
    select * into v_match from matches where id = v_report.match_id for update;

    if v_match.status = 'active' then
      select array_agg(user_id) into v_participants
      from match_participants where match_id = v_match.id;

      for i in 1..coalesce(array_length(v_participants, 1), 0) loop
        perform public.apply_wallet_transaction(
          v_participants[i], 'refund', v_match.stake_amount, v_match.id::text,
          'Match disputed - stake refunded by admin'
        );
      end loop;

      update matches set status = 'cancelled' where id = v_match.id;
    end if;

    update match_reports
    set status = 'resolved_refund', admin_notes = p_admin_notes,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_report_id
    returning * into v_report;
  else
    update match_reports
    set status = 'dismissed', admin_notes = p_admin_notes,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_report_id
    returning * into v_report;
  end if;

  return v_report;
end;
$$;
