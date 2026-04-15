-- Let hosts choose whether bookings are auto-confirmed or require
-- manual approval. Default true keeps existing behavior.

alter table public.time_slots
  add column if not exists auto_approve boolean not null default true;
