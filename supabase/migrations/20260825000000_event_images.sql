-- Event cover images + visibility.
--   1. events.image_url  — public storage URL of the cover image (optional).
--   2. events.visibility — 'public' | 'private'; students only see 'public'.
--   3. event-images bucket + storage policies (anon-based, matching the
--      project's no-Supabase-Auth model; storage.objects RLS is ON by default
--      with zero policies, which silently blocks all browser uploads).
-- Run this in the Supabase SQL editor. Idempotent.

alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists visibility text not null default 'public';

insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true) on conflict (id) do nothing;

create policy if not exists "event-images upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'event-images');
create policy if not exists "event-images update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'event-images') with check (bucket_id = 'event-images');
create policy if not exists "event-images delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'event-images');
create policy if not exists "event-images read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'event-images');