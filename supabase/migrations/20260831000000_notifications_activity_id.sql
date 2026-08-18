-- notifications.activity_id so activity shares route to the Activity page (20260831000000)

alter table public.notifications add column if not exists activity_id text;