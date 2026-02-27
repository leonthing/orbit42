"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAllPosts, removePost, logout } from "./actions";
import type { SupabasePost } from "@/lib/supabase-posts";
import Link from "next/link";

export function AdminDashboard() {
  const router = useRouter();
  const [posts, setPosts] = useState<SupabasePost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    setLoading(true);
    const result = await fetchAllPosts();
    if ("posts" in result && result.posts) {
      setPosts(result.posts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleDelete = async (slug: string) => {
    if (!confirm(`"${slug}" 글을 삭제하시겠습니까?`)) return;
    await removePost(slug);
    loadPosts();
  };

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.filter((p) => !p.published).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-400">
            블로그 콘텐츠를 관리하세요
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/write"
            className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-navy-700 hover:shadow-md dark:bg-navy-500 dark:hover:bg-navy-600"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            새 글 작성
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-charcoal-200 bg-white px-4 py-2.5 text-sm text-charcoal-600 shadow-sm transition-all hover:bg-charcoal-50 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            로그아웃
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total posts */}
          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 dark:bg-navy-950/50">
                  <svg
                    className="h-5 w-5 text-navy-600 dark:text-navy-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal-500 dark:text-charcoal-400">
                    전체 글
                  </p>
                  <p className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
                    {posts.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Published */}
          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/50">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal-500 dark:text-charcoal-400">
                    공개
                  </p>
                  <p className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
                    {publishedCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Drafts */}
          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50 dark:bg-yellow-950/50">
                  <svg
                    className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal-500 dark:text-charcoal-400">
                    비공개
                  </p>
                  <p className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
                    {draftCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-charcoal-400 dark:text-charcoal-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
          <h2 className="text-lg font-semibold text-charcoal-900 dark:text-charcoal-100">
            글 관리
          </h2>
          <span className="rounded-full bg-charcoal-100 px-2.5 py-0.5 text-xs font-medium text-charcoal-600 dark:bg-charcoal-700 dark:text-charcoal-300">
            {posts.length}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-charcoal-200 bg-white py-16 dark:border-charcoal-700 dark:bg-charcoal-800/80">
            <div className="flex flex-col items-center gap-3">
              <svg
                className="h-8 w-8 animate-spin text-navy-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
                로딩 중...
              </p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-charcoal-200 bg-white/50 p-14 text-center dark:border-charcoal-700 dark:bg-charcoal-800/30">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100 dark:bg-charcoal-700">
              <svg
                className="h-7 w-7 text-charcoal-400 dark:text-charcoal-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-charcoal-600 dark:text-charcoal-400">
              아직 작성된 글이 없습니다
            </p>
            <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
              첫 번째 글을 작성하여 블로그를 시작해보세요
            </p>
            <Link
              href="/admin/write"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-navy-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700 dark:bg-navy-500 dark:hover:bg-navy-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              첫 글 작성하기
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
            <div className="divide-y divide-charcoal-100 dark:divide-charcoal-700/50">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-charcoal-50/50 dark:hover:bg-charcoal-700/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="truncate font-medium text-charcoal-900 dark:text-charcoal-100">
                        {post.title}
                      </h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          post.published
                            ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"
                            : "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            post.published
                              ? "bg-green-500 dark:bg-green-400"
                              : "bg-yellow-500 dark:bg-yellow-400"
                          }`}
                        />
                        {post.published ? "공개" : "비공개"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-sm text-charcoal-500 dark:text-charcoal-400">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                          />
                        </svg>
                        {post.category}
                      </span>
                      <span className="text-charcoal-300 dark:text-charcoal-600">
                        &middot;
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                          />
                        </svg>
                        {new Date(post.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pl-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/admin/write?slug=${post.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-600 transition-colors hover:bg-navy-50 dark:text-navy-400 dark:hover:bg-navy-950/50"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                        />
                      </svg>
                      수정
                    </Link>
                    <button
                      onClick={() => handleDelete(post.slug)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pages Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-charcoal-400 dark:text-charcoal-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-charcoal-900 dark:text-charcoal-100">
            페이지 관리
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
          <div className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-charcoal-50/50 dark:hover:bg-charcoal-700/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 dark:bg-navy-950/50">
                <svg
                  className="h-4.5 w-4.5 text-navy-600 dark:text-navy-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-charcoal-900 dark:text-charcoal-100">
                  About
                </h3>
                <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
                  /about 페이지 내용
                </p>
              </div>
            </div>
            <Link
              href="/admin/pages/about"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-navy-600 transition-colors hover:bg-navy-50 dark:text-navy-400 dark:hover:bg-navy-950/50"
            >
              편집
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
