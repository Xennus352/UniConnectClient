-- Realtime replica identity for event registrations + likes.
--
-- Realtime DELETE/UPDATE payloads only include columns covered by the table's
-- replica identity. With the default (PK-only) identity, a cancelled event
-- registration reached the browser as a DELETE event containing only the
-- registration id, so the UI could not tell which event changed — the
-- "Cancel Registration" button stayed until a full page refresh. The same
-- applied to unliking posts (the heart needed the deleted row's user_email).
--
-- Run this in the Supabase SQL editor (or re-run supabase/apply.sql).
alter table public.event_registrations replica identity full;
alter table public.post_likes replica identity full;
