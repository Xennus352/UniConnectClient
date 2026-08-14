-- Supabase schema for UniConnect post sharing.
-- Run this in the Supabase SQL editor after 20260813000000_init.sql.

alter table public.posts add column if not exists shares_count int not null default 0;

------------------------------------------------------------
-- post_shares
------------------------------------------------------------
create table if not exists public.post_shares (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references public.posts on delete cascade,
  sharer_email  text not null,
  sharer_name   text not null,
  recipients    jsonb not null default '[]'::jsonb,
  created_at    bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_shares_post on public.post_shares (post_id, created_at);

grant select, insert, update, delete on public.post_shares to anon, authenticated;
