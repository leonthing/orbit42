-- Blog upgrades: cover images + old-slug redirects.

-- Featured/cover image shown on the post page, blog list, and social cards.
alter table public.blog_posts
  add column if not exists cover_image text;

-- Keep old slugs working after a rename — the public post page falls back
-- to this table and 301s to the current slug.
create table if not exists public.blog_post_slugs (
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.blog_post_slugs enable row level security;
