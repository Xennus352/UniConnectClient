-- 1. posts.video_url — optional public storage URL for feed video posts.
-- 2. post-media bucket + storage policies (anon-based, matching the project's
--    no-Supabase-Auth model — same pattern as event-images / activity-media).

alter table public.posts add column if not exists video_url text;

insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict (id) do nothing;

drop policy if exists "post-media upload" on storage.objects;
create policy "post-media upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'post-media');

drop policy if exists "post-media update" on storage.objects;
create policy "post-media update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'post-media') with check (bucket_id = 'post-media');

drop policy if exists "post-media delete" on storage.objects;
create policy "post-media delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'post-media');

drop policy if exists "post-media read" on storage.objects;
create policy "post-media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'post-media');
