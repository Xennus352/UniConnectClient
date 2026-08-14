-- Supabase schema for UniConnect realtime features (replaces the Convex tables).
-- Run this ONCE in the Supabase SQL editor (https://supabase.com/dashboard).
-- Auth/identity is owned by the Spring Boot backend (httpOnly session +
-- /api/session). Supabase is used as a public realtime datastore, so RLS is
-- intentionally NOT enabled — per-user write authorization is enforced in the
-- application layer (Next.js API routes) using the Spring-identified email.

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
  type            text not null,   -- like | comment | message | follow | event | moderation
  message         text not null,
  read            boolean not null default false,
  created_at      bigint not null default (extract(epoch from now()) * 1000)
);
create index idx_notif_recipient on public.notifications (recipient_email, created_at desc);

------------------------------------------------------------
-- Realtime is enabled on all tables by default.
-- Grant the anon/authenticated roles full access so the browser
-- (anon key) can read/write the public datastore directly.
------------------------------------------------------------
grant all on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.posts,
  public.post_likes,
  public.post_comments,
  public.conversations,
  public.chat_messages,
  public.notifications
  to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- NOTE: no DB triggers here on purpose. Write-path authorization (chat
-- privacy: pending/active/blocked; likes/comments/messages; moderation;
-- notifications) is enforced server-side in Next.js API routes using a
-- service-role Supabase client + the Spring session email, so it cannot be
-- bypassed by the browser. The browser (anon key) does realtime READS only.

