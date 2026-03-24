-- Projects table (linked to businesses)
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  local_path text,
  git_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'paused', 'archived')),
  tech_stack text[] DEFAULT '{}',
  last_activity text,
  last_commit_msg text,
  last_commit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_business ON projects(business_id);
