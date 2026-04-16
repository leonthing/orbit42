-- Invite-only signup: each user gets N invite codes on registration.

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  creator_id uuid not null references public.users(id) on delete cascade,
  used_by uuid references public.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_creator_idx
  on public.invite_codes(creator_id);
create unique index if not exists invite_codes_code_idx
  on public.invite_codes(code);

alter table public.invite_codes enable row level security;

-- Helper: generate N random 8-char invite codes for a given user.
create or replace function generate_invite_codes(p_user_id uuid, p_count int)
returns void as $$
declare
  i int;
  new_code text;
begin
  for i in 1..p_count loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    insert into public.invite_codes (code, creator_id)
    values (new_code, p_user_id);
  end loop;
end;
$$ language plpgsql security definer;
