-- Add work experience to user profiles. Stored as a jsonb array of
-- objects: { company, role, description?, startYear?, endYear?, current? }.

alter table public.users
  add column if not exists experience jsonb not null default '[]'::jsonb;
