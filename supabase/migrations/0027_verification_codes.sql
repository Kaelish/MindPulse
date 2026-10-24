-- Six-digit codes for email, SMS and WhatsApp sign-in verification.
-- Only the verification-code edge function (service role) may read or write
-- this table; RLS plus a full revoke keeps it invisible to browser clients.

create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  destination text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

-- Re-running this migration on a project that already created the table with
-- the older two-channel constraint widens it to include SMS.
alter table public.verification_codes
  drop constraint if exists verification_codes_channel_check;
alter table public.verification_codes
  add constraint verification_codes_channel_check
  check (channel in ('email', 'whatsapp', 'sms'));

create index if not exists verification_codes_lookup_idx
  on public.verification_codes (user_id, channel, destination, created_at desc);

create index if not exists verification_codes_expiry_idx
  on public.verification_codes (expires_at);

alter table public.verification_codes enable row level security;

revoke all on table public.verification_codes from public, anon, authenticated;
grant all on table public.verification_codes to service_role;
