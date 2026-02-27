-- post_stats: 게시글별 조회수 집계
CREATE TABLE post_stats (
  post_slug text PRIMARY KEY,
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: 누구나 읽기, service role만 수정
ALTER TABLE post_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post_stats"
  ON post_stats FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert post_stats"
  ON post_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update post_stats"
  ON post_stats FOR UPDATE
  USING (true);

-- post_likes: 좋아요 개별 기록
CREATE TABLE post_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug text NOT NULL,
  visitor_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_slug, visitor_id)
);

-- RLS: 누구나 읽기/쓰기/삭제
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post_likes"
  ON post_likes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert post_likes"
  ON post_likes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete post_likes"
  ON post_likes FOR DELETE
  USING (true);
