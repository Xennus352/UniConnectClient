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
--   migrations/20260815000000_messages_preview_unread.sql (chat_messages.attachments,
--     conversations.preview + conversations.unread_map for the chat list)
--   migrations/20260817000000_lost_found.sql (posts.item_status + posts.item_location)
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
-- chat_messages.attachments (chat file attachments)
-- Each entry: { "name", "size", "mime", "path" } where "path" is
-- the object path inside the PRIVATE "chat-attachments" storage
-- bucket (signed URLs are issued server-side to participants only).
------------------------------------------------------------
alter table public.chat_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

------------------------------------------------------------
-- conversations.preview + unread_map (chat list)
-- preview holds the text of the last message; unread_map is a
-- jsonb map { email: count } tracking unread messages per participant.
------------------------------------------------------------
alter table public.conversations add column if not exists preview text;
alter table public.conversations add column if not exists unread_map jsonb not null default '{}'::jsonb;

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

------------------------------------------------------------
-- notifications navigation metadata (tap-to-go)
-- post_id: like/comment/share/moderation -> open the post on the feed.
-- conversation_id: message -> open the conversation in messages.
-- actor_email/actor_name: who triggered the notification (profile link).
------------------------------------------------------------
alter table public.notifications add column if not exists post_id uuid references public.posts on delete cascade;
alter table public.notifications add column if not exists conversation_id uuid references public.conversations on delete cascade;
alter table public.notifications add column if not exists actor_email text;
alter table public.notifications add column if not exists actor_name text;

create index if not exists idx_notif_post on public.notifications (post_id);
create index if not exists idx_notif_conv on public.notifications (conversation_id);

-- NOTE: no DB triggers here on purpose. Write-path authorization (chat
-- privacy: pending/active/blocked; likes/comments/messages; moderation;
-- notifications) is enforced server-side in Next.js API routes using a
-- service-role Supabase client + the Spring session email, so it cannot be
-- bypassed by the browser. The browser (anon key) does realtime READS only.

------------------------------------------------------------
-- Lost & Found: structured metadata on posts.
-- posts.item_status: 'lost' | 'found' | null
-- posts.item_location: campus location or null
------------------------------------------------------------
alter table public.posts add column if not exists item_status text;
alter table public.posts add column if not exists item_location text;

create index if not exists idx_posts_item_status on public.posts (item_status) where item_status is not null;
create index if not exists idx_posts_item_location on public.posts (item_location) where item_location is not null;
-- Supabase schema for UniConnect Events.
-- Events are created by admins / student affairs and browsed + registered by
-- everyone. Follows the existing schema conventions (bigint unix-ms timestamps,
-- Spring email stored on rows, no RLS — consistent with the other tables).
-- Run this in the Supabase SQL editor.

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  location        text,
  event_date      bigint not null,               -- unix ms
  category        text not null default 'Other', -- Sports | Academic | Cultural | Other
  max_attendees   int,
  created_by      text not null,
  created_by_name text not null,
  created_at      bigint not null default (extract(epoch from now()) * 1000)
);
create index idx_events_date on public.events (event_date desc);

create table public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references public.events on delete cascade,
  user_email text not null,
  user_name  text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)
);
create unique index idx_event_registrations_unique on public.event_registrations (event_id, user_email);
create index idx_event_registrations_event on public.event_registrations (event_id);

------------------------------------------------------------
-- Exam Result distribution: system inbox messages
------------------------------------------------------------
alter table public.chat_messages
  add column if not exists sender_id uuid,
  add column if not exists recipient_id uuid,
  add column if not exists recipient_email text,
  add column if not exists message_type text not null default 'text',
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists roll_number text;

create index if not exists idx_chat_messages_recipient_type
  on public.chat_messages (recipient_email, message_type, created_at desc);

------------------------------------------------------------
-- Exam Results distribution: dedicated published-results table
------------------------------------------------------------
create table if not exists public.exam_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  recipient_email text not null,
  roll_number     text not null,
  year            text not null,
  semester        text not null,
  file_name       text not null,
  file_url        text not null,
  storage_path    text not null,
  created_at      bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_exam_results_recipient
  on public.exam_results (recipient_email, created_at desc);

grant select, insert on public.exam_results to anon, authenticated;
------------------------------------------------------------
-- Exam Result Batches: aggregate grouping for sent PDFs
------------------------------------------------------------
create table if not exists public.exam_result_batches (
  id            uuid primary key default gen_random_uuid(),
  exam_type     text not null,
  semester      text not null,
  academic_year text not null,
  total_files   integer not null default 0,
  status        text not null default 'UPLOADED',
  created_by    text,
  created_at    bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_exam_result_batches_created
  on public.exam_result_batches (created_at desc);

alter table public.exam_results
  add column if not exists batch_id uuid references public.exam_result_batches(id) on delete set null,
  add column if not exists student_name text;
create index if not exists idx_exam_results_batch
  on public.exam_results (batch_id);
alter table public.exam_results
  add column if not exists student_id text;
create index if not exists idx_exam_results_student
  on public.exam_results (student_id);

grant select, insert, update, delete on public.exam_result_batches to anon, authenticated;
grant update on public.exam_results to anon, authenticated;

-- Enable Realtime for exam result sync
alter publication supabase_realtime add table public.exam_result_batches;
alter publication supabase_realtime add table public.exam_results;

-- Disable RLS so browser reads + realtime work (project uses grants +
-- server-side authorization in API routes; RLS blocks all reads otherwise)
alter table public.exam_results disable row level security;
alter table public.exam_result_batches disable row level security;
