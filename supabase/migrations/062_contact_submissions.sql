-- Lucky Jambo - Contact form storage + admin visibility
--
-- app/api/contact/route.ts has queried and inserted into a
-- `contact_submissions` table since it was written (originally just
-- for IP-based rate limiting), but no migration in this repo ever
-- created that table. Every submission's rate-limit check silently
-- fails open (caught, logged, treated as "not rate limited") and the
-- logging insert silently fails too (caught, logged, ignored) - the
-- message only ever left the system as an outbound email via Resend.
-- There was no row anywhere for the admin panel to read, and no
-- admin page even existed to read one.
--
-- This creates the table with the full submission content (not just
-- ip/email, which was only ever enough for rate limiting) so the
-- admin panel has something to show, and adds admin RLS so staff can
-- review messages from the dashboard.

create table if not exists contact_submissions (
    id uuid primary key default uuid_generate_v4(),
    ip text not null,
    name text not null,
    email text not null,
    subject text not null,
    message text not null,
    status text not null default 'new' check (status in ('new', 'read', 'archived')),
    created_at timestamptz not null default now()
);

create index if not exists idx_contact_submissions_ip_created
  on contact_submissions(ip, created_at);

create index if not exists idx_contact_submissions_status
  on contact_submissions(status, created_at desc);

alter table contact_submissions enable row level security;

-- No policies for anon/authenticated: submissions are only ever
-- written by the API route's service-role client (createAdminClient),
-- which bypasses RLS entirely. Regular users have no reason to read
-- or write this table directly.

create policy "admins view contact submissions"
on contact_submissions
for select
using (is_admin());

create policy "admins update contact submissions"
on contact_submissions
for update
using (is_admin());
