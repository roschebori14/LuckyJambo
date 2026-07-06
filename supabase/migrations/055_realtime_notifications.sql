-- Lucky Jambo - Realtime notifications
--
-- The notifications table (001_initial_schema.sql) has been fed by
-- notify_user() for a long time (opponent joined, match settled,
-- withdrawal auto-processed, friend request, direct challenge...) but
-- nothing ever surfaced it live - only /notifications (a manually
-- refreshed page) showed them, and only direct messages got a toast +
-- sound (see components/messages/dm-toast-listener.tsx). This is the
-- direct cause behind several sound effects (`notification`,
-- `deposit-success`-adjacent events, `withdrawal-success`) never
-- audibly firing: the events were happening, nothing ever told the
-- client in real time.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;
end $$;
