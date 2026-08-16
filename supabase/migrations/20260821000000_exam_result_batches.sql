------------------------------------------------------------
-- Exam Result Batches: aggregate grouping for sent PDFs
------------------------------------------------------------
create table if not exists public.exam_result_batches (
  id            uuid primary key default gen_random_uuid(),
  exam_type     text not null,
  semester      text not null,
  academic_year text not null,
  total_files   integer not null default 0,
  status        text not null default 'UPLOADED',
  created_by    text,
  created_at    bigint not null default (extract(epoch from now()) * 1000)
);
create index if not exists idx_exam_result_batches_created
  on public.exam_result_batches (created_at desc);

alter table public.exam_results
  add column if not exists batch_id uuid references public.exam_result_batches(id) on delete set null,
  add column if not exists student_name text;
create index if not exists idx_exam_results_batch
  on public.exam_results (batch_id);

grant select, insert, update, delete on public.exam_result_batches to anon, authenticated;
grant update on public.exam_results to anon, authenticated;
