-- Trim expired verification / reset tokens so the tables don't grow
-- without bound. The function is also handy to run on-demand from a
-- Vercel cron route if pg_cron isn't available on the plan.

create or replace function public.cleanup_auth_tokens()
returns void as $$
begin
  delete from public.email_verification_tokens
    where expires_at < now() or used_at is not null;
  delete from public.password_reset_tokens
    where expires_at < now() or used_at is not null;
end;
$$ language plpgsql security definer;

-- Best-effort: schedule hourly if pg_cron is available. Safe to skip
-- if the extension isn't installed in this Supabase plan.
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule(
      'orbit42_cleanup_auth_tokens',
      '@hourly',
      $cron$select public.cleanup_auth_tokens();$cron$
    );
  end if;
exception when others then
  -- Ignore if cron schema not accessible with current role.
  null;
end $$;
