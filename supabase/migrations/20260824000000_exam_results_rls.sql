------------------------------------------------------------
-- Exam Results: disable RLS so browser reads + realtime work
-- (consistent with every other table in this project, which
-- relies on grants + server-side authorization in API routes)
------------------------------------------------------------
alter table public.exam_results disable row level security;
alter table public.exam_result_batches disable row level security;