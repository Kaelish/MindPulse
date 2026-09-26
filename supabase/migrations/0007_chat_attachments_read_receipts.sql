-- 0007_chat_attachments_read_receipts.sql
-- Chat upgrade: file attachments (images + documents) stored in a private
-- Supabase Storage bucket, per-message read receipts, and a thread-summary
-- RPC that powers conversation lists with previews + unread badges on the
-- patient app, the doctor mobile app, and the web doctor portal.
--
-- Attachment storage layout (private bucket):
--   chat-attachments/{patient_id}/{clinician_id}/{message_id}_{filename}
-- The first two path segments are the conversation participants, which is
-- exactly what the storage RLS policy checks. Clients store the storage
-- *path* on the message row and mint short-lived signed URLs when rendering.

-- ---------------------------------------------------------------------------
-- 1. chat_messages: attachment + read receipt columns
-- ---------------------------------------------------------------------------

alter table public.chat_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_kind text
    check (attachment_kind in ('image', 'document')),
  add column if not exists read_at         timestamptz;

comment on column public.chat_messages.attachment_url  is
  'Storage path inside the chat-attachments bucket; rendered through a signed URL.';
comment on column public.chat_messages.attachment_name is
  'Original filename as chosen by the sender.';
comment on column public.chat_messages.attachment_kind is
  'image | document — controls the bubble treatment in every client.';
comment on column public.chat_messages.read_at is
  'Set once the RECIPIENT has seen the message; null means unread. On your own messages this is the other party read receipt.';

-- Unread lookups: messages from the other side that are still unread.
create index if not exists chat_messages_unread_idx
  on public.chat_messages (patient_id, clinician_id, read_at)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 2. Private storage bucket for chat attachments
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  15728640, -- 15 MB — generous for photos and PDFs, small enough to be sane
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Participants only: the caller's uid must be one of the two conversation
-- folders in the object path (patient/clinician/file).
drop policy if exists "chat_attachments_participants" on storage.objects;
create policy "chat_attachments_participants" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'chat-attachments'
    and auth.uid()::text in (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Read receipts: mark everything the caller received from p_other as read
--    SECURITY DEFINER so the recipient can stamp read_at on rows they did not
--    send without widening the row-level UPDATE policy (which would also let
--    them rewrite the sender's text).
-- ---------------------------------------------------------------------------

create or replace function public.mark_chat_read(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_other is null or auth.uid() is null then
    return;
  end if;

  update public.chat_messages
     set read_at = now()
   where read_at is null
     and (
       (patient_id = auth.uid() and clinician_id = p_other and sender = 'doctor')
        or (clinician_id = auth.uid() and patient_id = p_other and sender = 'patient')
     );
end;
$$;

revoke execute on function public.mark_chat_read(uuid) from anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Thread summaries: one row per conversation with preview + unread count
--    SECURITY INVOKER — chat_messages RLS already scopes rows to the caller,
--    so both roles get exactly their own threads.
-- ---------------------------------------------------------------------------

create or replace function public.chat_threads()
returns table (
  other_id             uuid,
  last_text            text,
  last_sender          text,
  last_attachment_kind text,
  last_attachment_name text,
  last_at              timestamptz,
  unread_count         bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select
      case when patient_id = auth.uid() then clinician_id else patient_id end as other_id,
      case when patient_id = auth.uid() then 'patient' else 'doctor' end     as my_side,
      sender,
      text,
      attachment_kind,
      attachment_name,
      created_at,
      read_at
    from public.chat_messages
    where patient_id = auth.uid()
       or clinician_id = auth.uid()
  )
  select
    m.other_id,
    (array_agg(m.text order by m.created_at desc))[1]                              as last_text,
    (array_agg(m.sender order by m.created_at desc))[1]                            as last_sender,
    (array_agg(m.attachment_kind order by m.created_at desc))[1]                   as last_attachment_kind,
    (array_agg(m.attachment_name order by m.created_at desc))[1]                   as last_attachment_name,
    max(m.created_at)                                                              as last_at,
    count(*) filter (where m.sender <> m.my_side and m.read_at is null)            as unread_count
  from mine m
  group by m.other_id
  order by max(m.created_at) desc;
$$;

revoke execute on function public.chat_threads() from anon;
grant execute on function public.chat_threads() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Realtime: both INSERTs and read-receipt UPDATEs must reach subscribers
--    (receipts are stamped by the other party, so clients subscribe to '*').
--    Skips silently when the publication does not exist locally.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_publication p where p.pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
  end if;
exception
  when insufficient_privilege or duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. migration_report marker
-- ---------------------------------------------------------------------------

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'chat_messages', null, null,
       'applied 0007: chat attachments (chat-attachments bucket + RLS), read receipts (read_at + mark_chat_read), chat_threads() preview/unread RPC'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'chat_messages'
    and problem like 'applied 0007%'
);
