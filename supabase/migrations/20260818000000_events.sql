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
