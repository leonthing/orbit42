-- Unified comment thread for blog posts and feed posts.
--
-- We keep the legacy public `comments` table untouched (used by older
-- blog entries). New comments go through `post_comments` which has a
-- target_type/target_id split so the same component works across
-- both surfaces, plus a proper FK to users and reply nesting.

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('feed_post', 'blog_post')),
  target_id text not null,
  author_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_target_idx
  on public.post_comments(target_type, target_id, created_at);
create index if not exists post_comments_parent_idx
  on public.post_comments(parent_id);
create index if not exists post_comments_author_idx
  on public.post_comments(author_id);

alter table public.post_comments enable row level security;

-- Extend reactions.target_type to allow 'comment'.
alter table public.reactions
  drop constraint if exists reactions_target_type_check;
alter table public.reactions
  add constraint reactions_target_type_check
  check (target_type in ('event', 'post', 'slot', 'feed_post', 'comment'));
