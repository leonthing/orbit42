-- Email-based auth: required email, verification flag, token tables.

alter table public.users
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false;

-- Ensure email is unique when present so we can safely look up users
-- by email during login/reset flows.
create unique index if not exists idx_users_email_unique
  on public.users(lower(email))
  where email is not null;

create table if not exists public.email_verification_tokens (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_evt_user on public.email_verification_tokens(user_id);

create table if not exists public.password_reset_tokens (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_prt_user on public.password_reset_tokens(user_id);

-- Reset a user's password without knowing the previous one. Callable by
-- server-side admin client after validating a reset token.
create or replace function reset_password_for_user(p_user_id uuid, p_new_password text)
returns boolean as $$
begin
  update public.users
  set password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;
  return found;
end;
$$ language plpgsql security definer;
