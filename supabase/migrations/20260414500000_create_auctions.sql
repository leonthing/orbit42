-- Auction-mode pricing for time slots: bidders compete for a single
-- scheduled time, highest bidder wins when the auction closes.
ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed'
    CHECK (pricing_model IN ('fixed', 'auction')),
  ADD COLUMN IF NOT EXISTS reserve_price_cents integer,
  ADD COLUMN IF NOT EXISTS auction_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_high_bid_cents integer,
  ADD COLUMN IF NOT EXISTS current_high_bidder_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bids_slot_idx ON bids (slot_id, created_at DESC);
CREATE INDEX bids_bidder_idx ON bids (bidder_id);
