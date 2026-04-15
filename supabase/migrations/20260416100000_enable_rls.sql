-- Enable RLS on every user-owned table as a defense in depth. All
-- server-side code uses the service-role admin client which bypasses
-- RLS, so enabling policies here only affects anon/authed clients
-- (which we do NOT use). Locks the back door shut in case a future
-- change accidentally exposes one of these tables to an anon key.
--
-- Default policy: deny. Service role already bypasses, so app stays
-- functional; any new client-side Supabase access must explicitly add
-- policies.

alter table public.time_slots enable row level security;
alter table public.slot_availabilities enable row level security;
alter table public.bookings enable row level security;
alter table public.bids enable row level security;
alter table public.calendars enable row level security;
alter table public.events enable row level security;
alter table public.feed_posts enable row level security;
alter table public.menus enable row level security;
alter table public.slot_menus enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.reactions enable row level security;

-- Drop any overly-permissive legacy anon policies if they exist.
do $$
declare
  r record;
begin
  for r in (
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'time_slots', 'slot_availabilities', 'bookings', 'bids',
        'calendars', 'events', 'feed_posts', 'menus', 'slot_menus',
        'email_verification_tokens', 'password_reset_tokens', 'reactions'
      )
  ) loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
