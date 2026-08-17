------------------------------------------------------------
-- Exam Results: enable Realtime for live sync
------------------------------------------------------------
alter publication supabase_realtime add table public.exam_result_batches;
alter publication supabase_realtime add table public.exam_results;