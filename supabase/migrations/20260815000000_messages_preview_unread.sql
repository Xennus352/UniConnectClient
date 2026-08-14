-- Chat improvements:
--   1. chat_messages.attachments   — jsonb array of { name, size, mime, path } for file sharing.
--   2. conversations.preview       — text preview of the last message (shown in the chat list).
--   3. conversations.unread_map    — jsonb map { email: count } of unread messages per participant.
-- Run this in the Supabase SQL editor after 20260813000000_init.sql.

alter table public.chat_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.conversations add column if not exists preview text;
alter table public.conversations add column if not exists unread_map jsonb not null default '{}'::jsonb;
