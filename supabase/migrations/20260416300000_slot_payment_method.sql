-- Host chooses how a paid slot is settled: online (future Toss/Stripe)
-- or offline (pay in person to the host). Defaults to offline so
-- existing slots work today without an integration.
alter table public.time_slots
  add column if not exists payment_method text
    check (payment_method in ('online', 'offline'))
    not null default 'offline';
