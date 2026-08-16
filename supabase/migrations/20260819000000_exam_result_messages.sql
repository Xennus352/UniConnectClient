------------------------------------------------------------
-- Exam Result distribution: system inbox messages
------------------------------------------------------------
alter table public.chat_messages
  add column if not exists sender_id uuid,
  add column if not exists recipient_id uuid,
  add column if not exists recipient_email text,
  add column if not exists message_type text not null default 'text',
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists roll_number text;

create index if not exists idx_chat_messages_recipient_type
  on public.chat_messages (recipient_email, message_type, created_at desc);