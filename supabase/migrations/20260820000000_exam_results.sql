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