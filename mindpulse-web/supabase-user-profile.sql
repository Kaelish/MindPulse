-- Run this once in Supabase SQL Editor before using the web profile sync.
-- Supabase Auth remains the only place where passwords are stored.

ALTER TABLE public."USER"
  DROP COLUMN IF EXISTS PASSWORD_HASH;

ALTER TABLE public."USER"
  DROP CONSTRAINT IF EXISTS "USER_pkey";

ALTER TABLE public."USER"
  ADD CONSTRAINT "USER_pkey" PRIMARY KEY (USER_ID);

ALTER TABLE public."USER"
  DROP CONSTRAINT IF EXISTS "USER_USER_ID_auth_fkey";

ALTER TABLE public."USER"
  ADD CONSTRAINT "USER_USER_ID_auth_fkey"
  FOREIGN KEY (USER_ID) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."USER" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public."USER";
DROP POLICY IF EXISTS "Users can create their own profile" ON public."USER";
DROP POLICY IF EXISTS "Users can update their own profile" ON public."USER";

CREATE POLICY "Users can read their own profile"
  ON public."USER" FOR SELECT
  TO authenticated
  USING (auth.uid() = USER_ID);

CREATE POLICY "Users can create their own profile"
  ON public."USER" FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = USER_ID);

CREATE POLICY "Users can update their own profile"
  ON public."USER" FOR UPDATE
  TO authenticated
  USING (auth.uid() = USER_ID)
  WITH CHECK (auth.uid() = USER_ID);
