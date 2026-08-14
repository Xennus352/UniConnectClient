-- ============================================================================
-- UniConnect — Supabase realtime schema (complete, consolidated).
--
-- HOW TO APPLY:
--   1. Open the Supabase Dashboard: https://supabase.com/dashboard
--   2. Select your project (nhvyqavnctxcmumzbkvd)
--   3. Go to SQL Editor -> New query
--   4. Paste this ENTIRE file and click Run.
--      (or: Settings -> Database -> Connection string, then run it with psql)
--
-- This is the concatenation of:
--   migrations/20260813000000_init.sql   (posts, likes, comments, convs, msgs, notifs)
--   migrations/20260814000000_shares.sql (post_shares + posts.shares_count)
--   migrations/20260814020000_updated_at.sql (posts/comments updated_at for "edited" flag)
-- It is idempotent-safe and has been verified against PostgreSQL 16.
-- ============================================================================

create extension if not exists "uuid-ossp";

------------------------------------------------------------
-- (Identity lives in the Spring Boot `users` table + the
--  httpOnly `uniconnect_session` cookie. Supabase holds only
--  the realtime data and stores the Spring email on each row.)
------------------------------------------------------------

------------------------------------------------------------
-- posts (with moderation state)
------------------------------------------------------------
create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  author_role     text not null,
  content         text not null,
  image           text,
  tags            jsonb not null default '[]'::jsonb,
  status          text not null default 'pending_ai',  -- pending_ai | pending_review | approved | rejected
  ai_flags        text,
  moderation_note text,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  likes_count     int not null default 0,
  comments_count  int not null default 0
);
create index idx_posts_status_created on public.posts (status, created_at desc);
create index idx_posts_author on public.posts (author_email);

------------------------------------------------------------
-- post_likes
------------------------------------------------------------
create table public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts on delete cascade,
  user_email text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)
);
create unique index idx_post_likes_unique on public.post_likes (post_id, user_email);

------------------------------------------------------------
-- post_comments
------------------------------------------------------------
create table public.post_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.posts on delete cascade,
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  content         text not null,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  deleted_at      bigint
);
create index idx_comments_post on public.post_comments (post_id, created_at);

------------------------------------------------------------
-- conversations (with message-request privacy)
------------------------------------------------------------
create type public.conversation_status as enum ('pending', 'active', 'blocked');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  participant_ids text[] not null,
  status          public.conversation_status not null default 'active',
  requested_by    text,
  blocked_by      text,
  participant_meta jsonb,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  last_message_at bigint not null default (extract(epoch from now()) * 1000)
);
create index idx_conv_last on public.conversations (last_message_at desc);

------------------------------------------------------------
-- chat_messages
------------------------------------------------------------
create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations on delete cascade,
  sender_email    text not null,
  sender_name     text not null,
  content         text not null,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  is_read         boolean not null default false
);
create index idx_chat_conv on public.chat_messages (conversation_id, created_at);

------------------------------------------------------------
-- notifications
------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text,
  recipient_role  text,
  type            text not null,   -- like | comment | share | message | follow | event | moderation
  message         text not null,
  read            boolean not null default false,
  created_at      bigint not null default (extract(epoch from now()) * 1000)
);
create index idx_notif_recipient on public.notifications (recipient_email, created_at desc);

------------------------------------------------------------
-- posts.shares_count + post_shares (share feature)
------------------------------------------------------------
alter table public.posts add column if not exists shares_count int not null default 0;

create table if not exists public.post_shares (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references public.posts on delete cascade,
  sharer_email  text not null,
  sharer_name   text not null,
  recipients    jsonb not null default '[]'::jsonb,
  created_at    bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_shares_post on public.post_shares (post_id, created_at);

------------------------------------------------------------
-- Realtime is enabled on all tables by default.
-- Grant the anon/authenticated roles full access so the browser
-- (anon key) can read the public datastore directly.
------------------------------------------------------------
grant all on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.posts,
  public.post_likes,
  public.post_comments,
  public.conversations,
  public.chat_messages,
  public.notifications,
  public.post_shares
  to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

------------------------------------------------------------
-- Edited-flag support: updated_at on posts + post_comments.
-- Backfilled to created_at so existing rows are NOT flagged.
------------------------------------------------------------
alter table public.posts add column if not exists updated_at bigint not null default (extract(epoch from now()) * 1000);
alter table public.post_comments add column if not exists updated_at bigint not null default (extract(epoch from now()) * 1000);

update public.posts set updated_at = created_at;
update public.post_comments set updated_at = created_at;

-- NOTE: no DB triggers here on purpose. Write-path authorization (chat
-- privacy: pending/active/blocked; likes/comments/messages; moderation;
-- notifications) is enforced server-side in Next.js API routes using a
-- service-role Supabase client + the Spring session email, so it cannot be
-- bypassed by the browser. The browser (anon key) does realtime READS only.
