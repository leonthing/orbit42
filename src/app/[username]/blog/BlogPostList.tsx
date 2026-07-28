"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useMemo, useTransition } from "react";
import type { BlogPost } from "./actions";
import { createBlogPost, deleteBlogPost, publishBlogPost, unpublishBlogPost } from "./actions";
import { useConfirm } from "@/components/ConfirmDialog";
import { PendingButton } from "@/components/PendingButton";

type Filter = "all" | "published" | "draft";

const FILTER_TABS: { label: string; value: Filter }[] = [
  { label: "전체", value: "all" },
  { label: "게시됨", value: "published" },
  { label: "임시저장", value: "draft" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function contentPreview(content: string, max = 150) {
  if (!content) return "";
  const stripped = content.replace(/[#*_`>\-\[\]()!]/g, "").replace(/\n+/g, " ").trim();
  return stripped.length > max ? stripped.slice(0, max) + "..." : stripped;
}

export default function BlogPostList({ initialPosts }: { initialPosts: BlogPost[] }) {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const confirm = useConfirm();
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let result = posts;
    if (filter === "published") result = result.filter((p) => p.published);
    if (filter === "draft") result = result.filter((p) => !p.published);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [posts, filter, search]);

  function handleCreate() {
    startTransition(async () => {
      const post = await createBlogPost();
      router.push(`/${params.username}/blog/${post.id}/edit`);
    });
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const ok = await confirm({
      title: "이 글을 삭제할까요?",
      body: "삭제한 글은 되돌릴 수 없어요.",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteBlogPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    });
  }

  function handleTogglePublish(e: React.MouseEvent, post: BlogPost) {
    e.stopPropagation();
    startTransition(async () => {
      const updated = post.published
        ? await unpublishBlogPost(post.id)
        : await publishBlogPost(post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">블로그</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            {posts.length}개의 글
          </p>
        </div>
        <PendingButton onClick={handleCreate} pending={isPending}>
          + 새 글
        </PendingButton>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목, 내용, 태그로 검색..."
          className="w-full rounded-lg border border-charcoal-800 bg-charcoal-900/40 py-2.5 pl-10 pr-4 text-sm text-charcoal-200 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/50"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? posts.length
              : tab.value === "published"
                ? posts.filter((p) => p.published).length
                : posts.filter((p) => !p.published).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.value
                  ? "bg-navy-500/15 text-navy-400"
                  : "text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-charcoal-600">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
          <svg className="h-12 w-12 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
          </svg>
          <p className="mt-4 text-sm text-charcoal-500">
            {search ? "검색 결과가 없습니다" : "작성된 글이 없습니다"}
          </p>
          <p className="mt-1 text-xs text-charcoal-600">
            {search
              ? "다른 키워드로 검색해보세요"
              : "생각을 기록하면 프로필과 피드에 함께 보여요"}
          </p>
          {!search && (
            <PendingButton
              onClick={handleCreate}
              pending={isPending}
              className="mt-5"
            >
              첫 글 쓰기
            </PendingButton>
          )}
        </div>
      ) : (
        <div className="divide-y divide-charcoal-800/40 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
          {filtered.map((post) => (
            <div
              key={post.id}
              onClick={() => router.push(`/${params.username}/blog/${post.slug}`)}
              className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-charcoal-800/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium text-charcoal-100">
                    {post.title || "제목 없음"}
                  </h3>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      post.published
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-charcoal-700/40 text-charcoal-400"
                    }`}
                  >
                    {post.published ? "게시됨" : "임시저장"}
                  </span>
                </div>
                {post.content && (
                  <p className="mt-1 truncate text-sm text-charcoal-500">
                    {contentPreview(post.content, 200)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-charcoal-600">
                  <span>{formatDate(post.updated_at)}</span>
                  {post.tags.length > 0 && (
                    <>
                      <span>·</span>
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded bg-charcoal-800/60 px-1.5 py-0.5 text-charcoal-400">
                          {tag}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="text-charcoal-500">+{post.tags.length - 3}</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => handleTogglePublish(e, post)}
                  title={post.published ? "게시 취소" : "게시"}
                  className={`rounded p-1 transition-colors ${
                    post.published
                      ? "text-emerald-400 hover:text-emerald-300"
                      : "text-charcoal-500 hover:text-charcoal-300"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleDelete(e, post.id)}
                  title="삭제"
                  className="rounded p-1 text-charcoal-500 transition-colors hover:text-red-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
