-- ============================================================================
-- 0004 – normalize the seeded administrator row for GoTrue
--
-- The 0003 seed inserted auth.users directly and left the one-time token
-- columns (confirmation_token, recovery_token, email_change,
-- email_change_token_new) as NULL. GoTrue's own signups always write '' and
-- its password-grant user query scans those columns into non-nullable Go
-- strings, so the admin login failed with "Database error querying schema"
-- while the pre-existing users (all with '') worked.
--
-- Idempotent: only touches rows where the value is NULL, which GoTrue never
-- writes itself.
-- ============================================================================
update auth.users
   set confirmation_token      = coalesce(confirmation_token, ''),
       recovery_token          = coalesce(recovery_token, ''),
       email_change            = coalesce(email_change, ''),
       email_change_token_new  = coalesce(email_change_token_new, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       reauthentication_token  = coalesce(reauthentication_token, ''),
       last_sign_in_at         = coalesce(last_sign_in_at, now()),
       updated_at              = now()
 where (confirmation_token is null
     or recovery_token is null
     or email_change is null
     or email_change_token_new is null
     or email_change_token_current is null
     or reauthentication_token is null
     or last_sign_in_at is null);
