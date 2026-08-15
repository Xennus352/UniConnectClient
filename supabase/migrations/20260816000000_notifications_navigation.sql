-- Notification navigation:
--   1. notifications.post_id         — like/comment/share/moderation -> jump to the post on the feed.
--   2. notifications.conversation_id — message -> open the conversation on the messages page.
--   3. notifications.actor_email     — the person who triggered it (profile link).
--   4. notifications.actor_name      — display name of the actor.
-- Run this in the Supabase SQL editor after 20260815000000_messages_preview_unread.sql.

alter table public.notifications add column if not exists post_id uuid references public.posts on delete cascade;
alter table public.notifications add column if not exists conversation_id uuid references public.conversations on delete cascade;
alter table public.notifications add column if not exists actor_email text;
alter table public.notifications add column if not exists actor_name text;

create index if not exists idx_notif_post on public.notifications (post_id);
create index if not exists idx_notif_conv on public.notifications (conversation_id);
