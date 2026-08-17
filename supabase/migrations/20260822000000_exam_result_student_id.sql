------------------------------------------------------------
-- Exam Results: store the exact matched student id per row
------------------------------------------------------------
alter table public.exam_results
  add column if not exists student_id text;
create index if not exists idx_exam_results_student
  on public.exam_results (student_id);