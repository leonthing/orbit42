-- Link mirrored calendar events back to their booking, and mark tentative
-- (not-yet-confirmed) bookings so the UI can render them as dashed/provisional.
-- A booking is mirrored to both the host's and the guest's native calendar;
-- `booking_id` lets us flip them to confirmed or remove them when the booking
-- status changes. ON DELETE CASCADE cleans up if a booking is ever hard-deleted.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tentative boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS events_booking_idx
  ON public.events(booking_id)
  WHERE booking_id IS NOT NULL;
