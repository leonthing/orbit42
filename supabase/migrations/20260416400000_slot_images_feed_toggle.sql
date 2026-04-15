-- Add media + feed visibility to time_slots.
alter table public.time_slots
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists show_on_feed boolean not null default true;

-- Public storage bucket for slot images. Insert into storage.buckets
-- idempotently; public read so we can serve the URLs directly.
insert into storage.buckets (id, name, public)
values ('slot-media', 'slot-media', true)
on conflict (id) do nothing;
