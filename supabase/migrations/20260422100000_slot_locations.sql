-- A slot can now offer multiple acceptable locations. The guest picks
-- one at booking time, and per-location travel buffers flow into the
-- availability calculation.

ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS locations text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill existing single-location slots into the new array.
UPDATE time_slots
SET locations = ARRAY[location_detail]
WHERE (locations IS NULL OR array_length(locations, 1) IS NULL)
  AND location_detail IS NOT NULL
  AND length(trim(location_detail)) > 0;

-- Remember the location the guest picked at booking time.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS selected_location text;
