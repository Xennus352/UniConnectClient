-- ============================================================================
-- UniConnect — Supabase schema for project hzjxcogeqnckadudxvqb
-- Mirrors utils/supabase/types.ts EXACTLY (17 tables + 1 enum).
-- Demo-grade RLS: anon/authenticated get full access because the frontend
-- talks to Supabase with the publishable key and NO Supabase auth session
-- (authentication is handled by the Spring Boot backend).
-- Run this in Dashboard → SQL Editor (or psql) once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- enum ----------
do $$ begin
  create type conversation_status as enum ('pending','active','blocked');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  role        text not null default 'STAFF',
  initials    text,
  major       text,
  created_at  bigint not null default (extract(epoch from now())*1000)::bigint
);

-- ---------- posts ----------
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  author_role     text not null,
  content         text not null,
  image           text,
  video_url       text,
  tags            jsonb,
  status          text not null default 'PENDING',
  ai_flags        text,
  moderation_note text,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  updated_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  likes_count     bigint not null default 0,
  comments_count  bigint not null default 0,
  shares_count    bigint not null default 0,
  item_status     text,
  item_location   text
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_status_idx    on public.posts (status);

-- ---------- post_likes ----------
create table if not exists public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null,
  user_email text not null,
  created_at bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ---------- post_shares ----------
create table if not exists public.post_shares (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null,
  sharer_email text not null,
  sharer_name  text not null,
  recipients   jsonb,
  created_at   bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists post_shares_post_idx on public.post_shares (post_id);

-- ---------- post_comments ----------
create table if not exists public.post_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null,
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  content         text not null,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  updated_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  deleted_at      bigint
);
create index if not exists post_comments_post_idx on public.post_comments (post_id);

-- ---------- activities ----------
create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  author_role     text not null,
  kind            text,
  caption         text,
  media_url       text,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  likes_count     bigint not null default 0,
  comments_count  bigint not null default 0,
  shares_count    bigint not null default 0
);
create index if not exists activities_created_at_idx on public.activities (created_at desc);

-- ---------- activity_likes ----------
create table if not exists public.activity_likes (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  user_email  text not null,
  created_at  bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists activity_likes_act_idx on public.activity_likes (activity_id);

-- ---------- activity_comments ----------
create table if not exists public.activity_comments (
  id              uuid primary key default gen_random_uuid(),
  activity_id     uuid not null,
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  content         text not null,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  updated_at      bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists activity_comments_act_idx on public.activity_comments (activity_id);

-- ---------- activity_shares ----------
create table if not exists public.activity_shares (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null,
  sharer_email text not null,
  sharer_name  text not null,
  recipients   jsonb,
  created_at   bigint not null default (extract(epoch from now())*1000)::bigint
);

-- ---------- conversations ----------
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  participant_ids  text[] not null,
  status           conversation_status not null default 'pending',
  requested_by     text,
  blocked_by       text,
  participant_meta jsonb,
  created_at       bigint not null default (extract(epoch from now())*1000)::bigint,
  last_message_at  bigint not null default (extract(epoch from now())*1000)::bigint,
  preview          text,
  unread_map       jsonb,
  hidden_map       jsonb
);

-- ---------- chat_messages ----------
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  sender_id       text,
  recipient_id    text,
  recipient_email text,
  sender_email    text not null,
  sender_name     text not null,
  content         text not null,
  attachments     jsonb,
  mentions        jsonb,
  message_type    text not null default 'text',
  file_url        text,
  file_name       text,
  roll_number     text,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  is_read         boolean not null default false
);
create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  recipient_email  text,
  recipient_role   text,
  type             text not null,
  message          text not null,
  read             boolean not null default false,
  created_at       bigint not null default (extract(epoch from now())*1000)::bigint,
  post_id          uuid,
  activity_id      uuid,
  conversation_id  uuid,
  actor_email      text,
  actor_name       text
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_email, created_at desc);

-- ---------- events ----------
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  location        text,
  event_date      bigint not null,
  category        text not null default 'general',
  max_attendees   bigint,
  image_url       text,
  visibility      text not null default 'public',
  created_by      text not null,
  created_by_name text not null,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint
);

-- ---------- event_registrations ----------
create table if not exists public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null,
  user_email text not null,
  user_name  text not null,
  created_at bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists event_reg_event_idx on public.event_registrations (event_id);

-- ---------- user_presence ----------
create table if not exists public.user_presence (
  email      text primary key,
  last_seen  bigint not null default (extract(epoch from now())*1000)::bigint,
  updated_at bigint not null default (extract(epoch from now())*1000)::bigint
);

-- ---------- exam_result_batches ----------
create table if not exists public.exam_result_batches (
  id            uuid primary key default gen_random_uuid(),
  exam_type     text not null,
  semester      text not null,
  academic_year text not null,
  total_files   bigint not null default 0,
  status        text not null default 'PENDING',
  created_by    text,
  created_at    bigint not null default (extract(epoch from now())*1000)::bigint
);

-- ---------- exam_results ----------
create table if not exists public.exam_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         text,
  recipient_email text not null,
  roll_number     text not null,
  year            text not null,
  semester        text not null,
  file_name       text not null,
  file_url        text not null,
  storage_path    text not null,
  created_at      bigint not null default (extract(epoch from now())*1000)::bigint,
  batch_id        uuid references public.exam_result_batches(id),
  student_name    text,
  student_id      text
);
create index if not exists exam_results_batch_idx on public.exam_results (batch_id);
create index if not exists exam_results_recipient_idx on public.exam_results (recipient_email);

-- ============================================================================
-- RLS: enabled with demo-grade permissive policies (anon key has NO Supabase
-- auth session; university authz lives in Spring Boot).
-- ============================================================================
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('profiles','posts','post_likes','post_shares','post_comments',
                        'activities','activity_likes','activity_comments','activity_shares',
                        'conversations','chat_messages','notifications','events',
                        'event_registrations','user_presence','exam_results','exam_result_batches')
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
    execute format('drop policy if exists "demo_full_access_anon" on public.%I;', t.tablename);
    execute format('drop policy if exists "demo_full_access_auth" on public.%I;', t.tablename);
    execute format('create policy "demo_full_access_anon" on public.%I for all to anon using (true) with check (true);', t.tablename);
    execute format('create policy "demo_full_access_auth" on public.%I for all to authenticated using (true) with check (true);', t.tablename);
  end loop;
end $$;
