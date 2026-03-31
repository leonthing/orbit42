-- Blog posts table
CREATE TABLE blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  excerpt text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_blog_posts_user_published ON blog_posts(user_id, published, published_at DESC);
CREATE INDEX idx_blog_posts_user_slug ON blog_posts(user_id, slug);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
