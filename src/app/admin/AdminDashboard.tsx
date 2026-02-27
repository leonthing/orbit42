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

  return (
    <div className="space-y-8">
      {/* Posts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
            글 관리
          </h1>
          <div className="flex gap-2">
            <Link
              href="/admin/write"
              className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 dark:bg-navy-500 dark:hover:bg-navy-600"
            >
              새 글 작성
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-charcoal-300 px-4 py-2 text-sm text-charcoal-600 transition-colors hover:bg-charcoal-100 dark:border-charcoal-600 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
            >
              로그아웃
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-charcoal-500">로딩 중...</p>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-charcoal-300 p-10 text-center dark:border-charcoal-600">
            <p className="text-charcoal-500 dark:text-charcoal-400">
              아직 작성된 글이 없습니다.
            </p>
            <Link
              href="/admin/write"
              className="mt-3 inline-block text-navy-600 hover:text-navy-500 dark:text-navy-400"
            >
              첫 글을 작성해보세요 &rarr;
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-200 rounded-lg border border-charcoal-200 dark:divide-charcoal-700 dark:border-charcoal-700">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-charcoal-900 dark:text-charcoal-100">
                      {post.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.published
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {post.published ? "공개" : "비공개"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-400">
                    {post.category} &middot;{" "}
                    {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 ml-4">
                  <Link
                    href={`/admin/write?slug=${post.slug}`}
                    className="rounded px-3 py-1.5 text-sm text-navy-600 transition-colors hover:bg-navy-50 dark:text-navy-400 dark:hover:bg-navy-950"
                  >
                    수정
                  </Link>
                  <button
                    onClick={() => handleDelete(post.slug)}
                    className="rounded px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pages */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-charcoal-900 dark:text-charcoal-100">
          페이지 관리
        </h2>
        <div className="divide-y divide-charcoal-200 rounded-lg border border-charcoal-200 dark:divide-charcoal-700 dark:border-charcoal-700">
          <div className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-medium text-charcoal-900 dark:text-charcoal-100">
                About
              </h3>
              <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-400">
                /about 페이지 내용
              </p>
            </div>
            <Link
              href="/admin/pages/about"
              className="rounded px-3 py-1.5 text-sm text-navy-600 transition-colors hover:bg-navy-50 dark:text-navy-400 dark:hover:bg-navy-950"
            >
              편집
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
