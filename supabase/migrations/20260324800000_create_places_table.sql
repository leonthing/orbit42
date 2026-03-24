CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_code text NOT NULL, -- ISO 3166-1 alpha-3 (e.g. KOR, USA, JPN)
  country_name text NOT NULL,
  city text,
  type text NOT NULL CHECK (type IN ('visited', 'wishlist')),
  visit_date date,
  memo text,
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_places_user ON places(user_id);
