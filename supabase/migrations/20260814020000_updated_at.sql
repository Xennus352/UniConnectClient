-- Edited-flag support: add updated_at to posts + post_comments.
-- Backfilled to created_at so existing rows are NOT flagged as edited.
alter table public.posts add column if not exists updated_at bigint not null default (extract(epoch from now()) * 1000);
alter table public.post_comments add column if not exists updated_at bigint not null default (extract(epoch from now()) * 1000);

update public.posts set updated_at = created_at;
update public.post_comments set updated_at = created_at;
