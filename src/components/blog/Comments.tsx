"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getComments,
  addComment,
  deleteComment,
  type Comment,
} from "@/app/blog/[slug]/actions";

interface CommentsProps {
  postSlug: string;
  isAdmin?: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function Comments({ postSlug, isAdmin }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const loadComments = () => {
    getComments(postSlug).then((data) => {
      setComments(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadComments();
  }, [postSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await addComment(postSlug, author, content);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setContent("");
        loadComments();
      }
    });
  };

  const handleDelete = (commentId: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteComment(commentId);
      loadComments();
    });
  };

  return (
    <section className="mt-12 border-t border-charcoal-200 pt-8 dark:border-charcoal-800">
      <h2 className="mb-6 text-xl font-bold text-charcoal-900 dark:text-charcoal-100">
        댓글 {!loading && comments.length > 0 && (
          <span className="ml-1 text-base font-normal text-charcoal-500 dark:text-charcoal-400">
            {comments.length}
          </span>
        )}
      </h2>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white dark:border-charcoal-700 dark:bg-charcoal-800/80">
          <div className="p-4">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="이름"
              maxLength={50}
              required
              className="mb-3 w-full rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900 sm:w-48"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="댓글을 작성하세요..."
              rows={3}
              maxLength={2000}
              required
              className="w-full rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2 text-sm leading-relaxed text-charcoal-900 placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            />
          </div>
          <div className="flex items-center justify-between border-t border-charcoal-100 px-4 py-3 dark:border-charcoal-700/50">
            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={isPending || !author.trim() || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
            >
              {isPending ? "등록 중..." : "댓글 작성"}
            </button>
          </div>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-charcoal-500 dark:text-charcoal-400">
          댓글 로딩 중...
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-charcoal-500 dark:text-charcoal-400">
          아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="group rounded-xl border border-charcoal-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800/80"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-700 dark:bg-navy-900 dark:text-navy-300">
                    {comment.author.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-charcoal-900 dark:text-charcoal-100">
                    {comment.author}
                  </span>
                  <span className="text-xs text-charcoal-400 dark:text-charcoal-500">
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="rounded p-1 text-charcoal-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="댓글 삭제"
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
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal-700 dark:text-charcoal-300">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
