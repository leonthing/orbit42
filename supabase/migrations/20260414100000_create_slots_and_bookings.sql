-- Time slots: a "service offering" a host puts up for sale or sharing.
CREATE TABLE time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  duration_min integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 24 * 60),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'KRW',
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  slot_type text NOT NULL DEFAULT '1on1'
    CHECK (slot_type IN ('1on1', 'companion', 'group')),
  location_type text
    CHECK (location_type IS NULL OR location_type IN ('online', 'in_person', 'phone')),
  location_detail text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, slug)
);

CREATE INDEX time_slots_host_idx ON time_slots (host_id);
CREATE INDEX time_slots_active_idx ON time_slots (host_id, active);

-- Specific datetime windows when a slot can be booked.
CREATE TABLE slot_availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count integer NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX slot_availabilities_slot_idx ON slot_availabilities (slot_id);
CREATE INDEX slot_availabilities_time_idx ON slot_availabilities (start_at);

-- Bookings: a guest reserves an availability of a slot.
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  availability_id uuid NOT NULL REFERENCES slot_availabilities(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES users(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text,
  message text,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'canceled', 'completed')),
  scheduled_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_host_idx ON bookings (host_id, scheduled_at DESC);
CREATE INDEX bookings_guest_idx ON bookings (guest_id, scheduled_at DESC);
CREATE INDEX bookings_availability_idx ON bookings (availability_id);
