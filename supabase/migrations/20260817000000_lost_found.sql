-- Supabase schema for UniConnect Lost & Found.
-- Adds structured lost/found metadata to posts (posts table already carries
-- the "Lost & Found" tag). Run this in the Supabase SQL editor.

alter table public.posts add column if not exists item_status text;
alter table public.posts add column if not exists item_location text;

create index if not exists idx_posts_item_status on public.posts (item_status) where item_status is not null;
create index if not exists idx_posts_item_location on public.posts (item_location) where item_location is not null;
