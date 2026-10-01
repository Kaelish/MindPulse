-- ============================================================================
-- 0011 – create the MindPlant progress table (it did not exist yet)
--
-- mindpulse-mobile/src/services/plantProgress.ts reads and upserts
-- public."MIND_PLANT_PROGRESS", but 0001 only ever guarded every reference
-- with `to_regclass(...) is not null` because the table was expected to come
-- from the legacy supabase-plant-progress.sql script - and this project never
-- had it. Without the table the plant screen and the post-session "grow your
-- plant" write fail with:
--   Could not find the table 'public.MIND_PLANT_PROGRESS' in the schema cache
--
-- Safe to re-run: create table if not exists + drop/create policy.
-- ============================================================================

create table if not exists public."MIND_PLANT_PROGRESS" (
  "USER_ID"             uuid primary key references auth.users (id) on delete cascade,
  "CURRENT_STAGE"       text        not null default 'Bare Pot',
  "CURRENT_STREAK"      integer     not null default 0,
  "TOTAL_GROWTH_POINTS" integer     not null default 0,
  "LAST_SESSION_DATE"   date,
  -- lower-case like every other table in this schema: public.set_updated_at()
  -- assigns to NEW.updated_at, which would never match a quoted "UPDATED_AT".
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public."MIND_PLANT_PROGRESS" is
  'One MindPlant row per signed-in user; keyed by auth.uid() (see 0001 §6b).';

alter table public."MIND_PLANT_PROGRESS" enable row level security;

-- Keep "USER_ID" unique so the app''s upsert on conflict works.
create unique index if not exists "MIND_PLANT_PROGRESS_USER_ID_key"
  on public."MIND_PLANT_PROGRESS" ("USER_ID");

-- Upgrade path for a database that ran an earlier copy of this file with the
-- upper-cased timestamp columns (public.set_updated_at() could not see them).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'MIND_PLANT_PROGRESS'
               and column_name = 'CREATED_AT') then
    alter table public."MIND_PLANT_PROGRESS" rename column "CREATED_AT" to created_at;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'MIND_PLANT_PROGRESS'
               and column_name = 'UPDATED_AT') then
    alter table public."MIND_PLANT_PROGRESS" rename column "UPDATED_AT" to updated_at;
  end if;
end $$;

drop policy if exists "plant_progress_select_own" on public."MIND_PLANT_PROGRESS";
create policy "plant_progress_select_own" on public."MIND_PLANT_PROGRESS"
  for select to authenticated
  using ("USER_ID" = auth.uid() or public.is_admin());

drop policy if exists "plant_progress_insert_own" on public."MIND_PLANT_PROGRESS";
create policy "plant_progress_insert_own" on public."MIND_PLANT_PROGRESS"
  for insert to authenticated
  with check ("USER_ID" = auth.uid());

drop policy if exists "plant_progress_update_own" on public."MIND_PLANT_PROGRESS";
create policy "plant_progress_update_own" on public."MIND_PLANT_PROGRESS"
  for update to authenticated
  using ("USER_ID" = auth.uid() or public.is_admin())
  with check ("USER_ID" = auth.uid());

drop trigger if exists set_updated_at_mind_plant_progress on public."MIND_PLANT_PROGRESS";
create trigger set_updated_at_mind_plant_progress
  before update on public."MIND_PLANT_PROGRESS"
  for each row execute function public.set_updated_at();
