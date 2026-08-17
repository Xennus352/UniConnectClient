-- Realtime hardening: replica identity + publication membership.
--
-- Realtime DELETE/UPDATE payloads only include columns covered by the table's
-- replica identity. With the default (PK-only) identity:
--   * a cancelled event registration arrived as a DELETE carrying only the
--     registration id, so the UI couldn't tell which event changed;
--   * an unlike DELETE carried no user_email, so the heart stayed red;
--   * worse: channels with FILTERS on non-PK columns received NO events at
--     all, because the filter is applied to the payload row, which only
--     contained the primary key. That silently broke comments, chat messages
--     and read receipts in realtime (they only appeared after a refresh).
--
-- REPLICA IDENTITY FULL makes DELETE/UPDATE payloads carry the whole row, so
-- filters match and the handlers have every column they need.
--
-- Run this in the Supabase SQL editor (or re-run supabase/apply.sql).
alter table public.event_registrations replica identity full;
alter table public.post_likes replica identity full;
alter table public.post_comments replica identity full;
alter table public.chat_messages replica identity full;
alter table public.message_reads replica identity full;

-- Belt-and-braces: guarantee every realtime table is in the supabase_realtime
-- publication. If the publication was ever restricted, channels subscribe but
-- silently receive nothing.
do $$
declare t text;
begin
  foreach t in array array[
    'posts', 'post_likes', 'post_comments', 'post_shares',
    'conversations', 'chat_messages', 'message_reads',
    'notifications', 'events', 'event_registrations',
    'exam_results', 'exam_result_batches'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;