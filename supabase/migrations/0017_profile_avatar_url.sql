-- 0017_profile_avatar_url.sql
-- Cross-user profile pictures.
--
-- Until now a user's avatar was stored ONLY in auth.users.user_metadata, which
-- the client can read solely for its own user. A doctor therefore could never
-- see a patient's photo (or vice versa), even though both already upload to
-- the same public profile-photos bucket (0009). Mirror the URL onto
-- public.profiles so the existing RLS policies can mediate cross-user reads:
--   * doctors see patients they share an appointment with (0001: has_appointment_with)
--   * patients see doctors (profiles_select_self_admin_link: role = 'doctor')
--   * everyone sees their own row
--
-- The column is nullable and read by the apps as progressive enhancement:
-- if this migration has not been applied yet, the clients fall back to
-- initials without breaking any list.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the profile photo in the profile-photos bucket; null when the user has not set one.';

-- Backfill from auth metadata. Idempotent (only fills nulls) and skips the
-- private-bucket fallback, whose URLs are short-lived signed links.
update public.profiles p
set avatar_url = nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and nullif(u.raw_user_meta_data ->> 'avatar_url', '') is not null
  and coalesce(u.raw_user_meta_data ->> 'avatar_bucket', 'profile-photos') = 'profile-photos';
