-- 0005_assessment_tools.sql
-- Admin-managed assessment questionnaires with their questions stored as
-- JSONB, so the admin portal's "Assessment Tools" CRUD and the student app's
-- assessment hub / survey runner share one source of truth.
--
-- question shape: { id, text, pill?, reverse?, options?: [{ value, label }] }
--   reverse    — reverse-scored item (stress contribution = 4 - raw), PSS-10 style
--   options    — when absent, the standard 0-4 Likert (Never .. Very Often)

create table if not exists public.assessment_tools (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  category         text not null default 'Supplementary'
                   check (category in ('Multi-Modal', 'Supplementary', 'Brief')),
  status           text not null default 'active'
                   check (status in ('active', 'draft', 'archived')),
  duration_minutes integer not null default 10
                   check (duration_minutes between 1 and 240),
  questions        jsonb not null default '[]'::jsonb,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.assessment_tools enable row level security;

drop policy if exists "assessment_tools_select" on public.assessment_tools;
create policy "assessment_tools_select" on public.assessment_tools
  for select to authenticated
  using (status = 'active' or public.is_admin());

drop policy if exists "assessment_tools_insert_admin" on public.assessment_tools;
create policy "assessment_tools_insert_admin" on public.assessment_tools
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "assessment_tools_update_admin" on public.assessment_tools;
create policy "assessment_tools_update_admin" on public.assessment_tools
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "assessment_tools_delete_admin" on public.assessment_tools;
create policy "assessment_tools_delete_admin" on public.assessment_tools
  for delete to authenticated
  using (public.is_admin());

create index if not exists assessment_tools_status_idx
  on public.assessment_tools (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Seeds: the three tools from the admin mockups.
-- ---------------------------------------------------------------------------

insert into public.assessment_tools (title, description, category, status, duration_minutes, questions)
select
  'PSS-10 Stress Assessment',
  'Multi-Modal (Survey + Facial + Heart Rate + Reaction Time)',
  'Multi-Modal', 'active', 15,
  '[
    {"id": 1,  "text": "In the last 24 hours, how often have you been upset because of something that happened unexpectedly?"},
    {"id": 2,  "text": "In the last 24 hours, how often have you felt that you were unable to control the important things in your life?"},
    {"id": 3,  "text": "In the last 24 hours, how often have you felt nervous and stressed?"},
    {"id": 4,  "text": "In the last 24 hours, how often have you felt confident about your ability to handle your personal problems?", "reverse": true},
    {"id": 5,  "text": "In the last 24 hours, how often have you felt that things were going your way?", "reverse": true},
    {"id": 6,  "text": "In the last 24 hours, how often have you found that you could not cope with all the things that you had to do?"},
    {"id": 7,  "text": "In the last 24 hours, how often have you been able to control irritations in your life?", "reverse": true},
    {"id": 8,  "text": "In the last 24 hours, how often have you felt that you were on top of things?", "reverse": true},
    {"id": 9,  "text": "In the last 24 hours, how often have you been angered because of things that were outside of your control?"},
    {"id": 10, "text": "In the last 24 hours, how often have you felt difficulties were piling up so high that you could not overcome them?"}
  ]'::jsonb
where not exists (select 1 from public.assessment_tools where title = 'PSS-10 Stress Assessment');

insert into public.assessment_tools (title, description, category, status, duration_minutes, questions)
select
  'Behavioral Stress Indicators',
  'Supplementary Survey',
  'Supplementary', 'active', 3,
  '[
    {"id": 1, "text": "I found it hard to concentrate on the tasks I needed to complete."},
    {"id": 2, "text": "I felt irritable with the people around me without a clear reason."},
    {"id": 3, "text": "I delayed or avoided responsibilities because I felt overwhelmed."},
    {"id": 4, "text": "I noticed my sleep quality got worse during stressful periods."},
    {"id": 5, "text": "I experienced headaches, jaw tension, or muscle pain this week."},
    {"id": 6, "text": "I felt nervous or on edge even when nothing stressful was happening."},
    {"id": 7, "text": "I relied on caffeine, sugar, or snacks to keep me going through the day."}
  ]'::jsonb
where not exists (select 1 from public.assessment_tools where title = 'Behavioral Stress Indicators');

insert into public.assessment_tools (title, description, category, status, duration_minutes, questions)
select
  'Follow-up Wellness Check',
  'Brief Survey',
  'Brief', 'active', 5,
  '[
    {"id": 1, "text": "Over the past week, how often did you feel calm and relaxed?", "reverse": true},
    {"id": 2, "text": "How often were you able to finish your daily tasks without feeling exhausted?", "reverse": true},
    {"id": 3, "text": "How often did you take short breaks to rest your eyes and mind?", "reverse": true},
    {"id": 4, "text": "How often did you feel supported by someone when you were stressed?", "reverse": true},
    {"id": 5, "text": "How often did stress interfere with your appetite or eating habits?"}
  ]'::jsonb
where not exists (select 1 from public.assessment_tools where title = 'Follow-up Wellness Check');

insert into public.migration_report (legacy_table, legacy_id, legacy_email, problem)
select 'assessment_tools', null, null,
       'applied 0005: assessment_tools table + RLS + 3 seeded questionnaires (PSS-10, Behavioral Stress Indicators, Follow-up Wellness Check)'
where not exists (
  select 1 from public.migration_report
  where legacy_table = 'assessment_tools'
    and problem like 'applied 0005%'
);
