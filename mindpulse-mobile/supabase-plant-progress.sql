-- Run once in Supabase SQL Editor before using mobile Auth and plant progress.
-- Passwords remain managed by Supabase Auth, never by public."USER".

ALTER TABLE public."USER"
  ALTER COLUMN PASSWORD_HASH DROP NOT NULL;

ALTER TABLE public."USER" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MIND_PLANT_PROGRESS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GROWTH_LOG" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GROWTH_STAGE" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS "MIND_PLANT_PROGRESS_USER_ID_key"
  ON public."MIND_PLANT_PROGRESS" (USER_ID);

DROP POLICY IF EXISTS "Users can read their own application profile" ON public."USER";
DROP POLICY IF EXISTS "Users can create their own application profile" ON public."USER";
DROP POLICY IF EXISTS "Users can update their own application profile" ON public."USER";
CREATE POLICY "Users can read their own application profile" ON public."USER"
  FOR SELECT TO authenticated USING (auth.uid() = USER_ID);
CREATE POLICY "Users can create their own application profile" ON public."USER"
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = USER_ID);
CREATE POLICY "Users can update their own application profile" ON public."USER"
  FOR UPDATE TO authenticated USING (auth.uid() = USER_ID) WITH CHECK (auth.uid() = USER_ID);

DROP POLICY IF EXISTS "Users can read their own plant progress" ON public."MIND_PLANT_PROGRESS";
DROP POLICY IF EXISTS "Users can create their own plant progress" ON public."MIND_PLANT_PROGRESS";
DROP POLICY IF EXISTS "Users can update their own plant progress" ON public."MIND_PLANT_PROGRESS";
CREATE POLICY "Users can read their own plant progress" ON public."MIND_PLANT_PROGRESS"
  FOR SELECT TO authenticated USING (auth.uid() = USER_ID);
CREATE POLICY "Users can create their own plant progress" ON public."MIND_PLANT_PROGRESS"
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = USER_ID);
CREATE POLICY "Users can update their own plant progress" ON public."MIND_PLANT_PROGRESS"
  FOR UPDATE TO authenticated USING (auth.uid() = USER_ID) WITH CHECK (auth.uid() = USER_ID);

DROP POLICY IF EXISTS "Users can read their own growth log" ON public."GROWTH_LOG";
DROP POLICY IF EXISTS "Users can create their own growth log" ON public."GROWTH_LOG";
CREATE POLICY "Users can read their own growth log" ON public."GROWTH_LOG"
  FOR SELECT TO authenticated USING (auth.uid() = USER_ID);
CREATE POLICY "Users can create their own growth log" ON public."GROWTH_LOG"
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = USER_ID);

DROP POLICY IF EXISTS "Authenticated users can read growth stages" ON public."GROWTH_STAGE";
CREATE POLICY "Authenticated users can read growth stages" ON public."GROWTH_STAGE"
  FOR SELECT TO authenticated USING (true);

INSERT INTO public."GROWTH_STAGE" (STAGE_NAME, REQUIRED_SESSIONS, DESCRIPTION, IS_LOCKED)
VALUES
  ('Bare Pot', 0, 'Your journey is ready to begin.', false),
  ('Seedling', 1, 'A tiny seedling has sprouted.', false),
  ('Sprout', 5, 'Your steady practice is helping it grow.', true),
  ('Young Plant', 10, 'Your healthy rhythm is taking root.', true),
  ('Mature Plant', 15, 'Your consistency is flourishing.', true),
  ('Full Bloom', 25, 'A strong and sustained wellness practice.', true)
ON CONFLICT (STAGE_NAME) DO NOTHING;
