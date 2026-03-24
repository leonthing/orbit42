-- ============================================
-- Orbit42 Platform Tables
-- ============================================

-- Business (사업체)
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  industry text,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Notes (노트)
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  category text DEFAULT 'memo' CHECK (category IN ('idea', 'meeting', 'memo')),
  pinned boolean DEFAULT false,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Contacts (네트워크)
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  role text,
  email text,
  phone text,
  tags text[] DEFAULT '{}',
  memo text,
  last_contact_at timestamptz,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Finance: Transactions (거래)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount bigint NOT NULL, -- 원 단위
  description text NOT NULL,
  category text,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Finance: Assets (자산)
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'other' CHECK (type IN ('cash', 'bank', 'investment', 'real_estate', 'other')),
  value bigint NOT NULL DEFAULT 0, -- 원 단위
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Calendar: Events (일정)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_businesses_user ON businesses(user_id);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_start ON events(user_id, start_at);
