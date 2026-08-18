-- Supabase schema for UniConnect Activities (TikTok-style vertical feed).
-- Activities are posted ONLY by admins / student affairs (video, photo or
-- text). Everyone can view, like, comment and share. Follows the existing
-- schema conventions (bigint unix-ms timestamps, Spring email stored on rows,
-- no RLS — consistent with the other tables). Run this in the Supabase SQL
-- editor. Idempotent.

create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  author_role     text not null,
  kind            text not null default 'text', -- video | photo | text
  caption         text,
  media_url       text,                          -- storage URL for video/photo
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  likes_count     int not null default 0,
  comments_count  int not null default 0,
  shares_count    int not null default 0
);
create index if not exists idx_activities_created on public.activities (created_at desc);
create index if not exists idx_activities_author on public.activities (author_email);

create table if not exists public.activity_likes (
  id         uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities on delete cascade,
  user_email text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)
);
create unique index if not exists idx_activity_likes_unique on public.activity_likes (activity_id, user_email);

create table if not exists public.activity_comments (
  id              uuid primary key default gen_random_uuid(),
  activity_id     uuid references public.activities on delete cascade,
  author_email    text not null,
  author_name     text not null,
  author_initials text not null,
  content         text not null,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  updated_at      bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_activity_comments_activity on public.activity_comments (activity_id, created_at);

create table if not exists public.activity_shares (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid references public.activities on delete cascade,
  sharer_email  text not null,
  sharer_name   text not null,
  recipients    jsonb not null default '[]'::jsonb,
  created_at    bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_activity_shares_activity on public.activity_shares (activity_id, created_at);

-- Public storage bucket for activity media (videos + photos), uploaded
-- straight from the browser by admins / student affairs (anon model).
insert into storage.buckets (id, name, public) values ('activity-media', 'activity-media', true) on conflict (id) do nothing;

drop policy if exists "activity-media upload" on storage.objects;
create policy "activity-media upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'activity-media');
drop policy if exists "activity-media update" on storage.objects;
create policy "activity-media update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'activity-media') with check (bucket_id = 'activity-media');
drop policy if exists "activity-media delete" on storage.objects;
create policy "activity-media delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'activity-media');
drop policy if exists "activity-media read" on storage.objects;
create policy "activity-media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'activity-media');

grant select, insert, update, delete on
  public.activities,
  public.activity_likes,
  public.activity_comments,
  public.activity_shares
  to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- Realtime DELETE/UPDATE payloads carry the whole row so the browser can
-- apply like/comment/share updates locally (see the replica-identity notes in
-- apply.sql for the other tables).
alter table public.activity_likes replica identity full;
alter table public.activity_comments replica identity full;

-- Belt-and-braces: make sure every activity table is in the realtime publication.
do $$
declare t text;
begin
  foreach t in array array[
    'activities', 'activity_likes', 'activity_comments', 'activity_shares'
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

-- Disable RLS so browser reads + realtime work (grants + server-side
-- authorization in API routes, matching the rest of the project).
alter table public.activities disable row level security;
alter table public.activity_likes disable row level security;
alter table public.activity_comments disable row level security;
alter table public.activity_shares disable row level security;
