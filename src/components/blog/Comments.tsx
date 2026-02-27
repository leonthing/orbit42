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

function ReplyForm({
  postSlug,
  parentId,
  onSubmitted,
  onCancel,
}: {
  postSlug: string;
  parentId: string;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await addComment(postSlug, author, content, parentId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setContent("");
        onSubmitted();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="overflow-hidden rounded-lg border border-charcoal-200 bg-white dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="p-3">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="이름"
            maxLength={50}
            required
            className="mb-2 w-full rounded-md border border-charcoal-200 bg-charcoal-50 px-2.5 py-1.5 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900 sm:w-40"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="답글을 작성하세요..."
            rows={2}
            maxLength={2000}
            required
            autoFocus
            className="w-full rounded-md border border-charcoal-200 bg-charcoal-50 px-2.5 py-1.5 text-xs leading-relaxed text-charcoal-900 placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
          />
        </div>
        <div className="flex items-center justify-between border-t border-charcoal-100 px-3 py-2 dark:border-charcoal-700/50">
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-charcoal-500 transition-colors hover:bg-charcoal-100 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending || !author.trim() || !content.trim()}
              className="rounded-md bg-navy-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
            >
              {isPending ? "등록 중..." : "답글"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  replies,
  postSlug,
  isAdmin,
  onReload,
}: {
  comment: Comment;
  replies: Comment[];
  postSlug: string;
  isAdmin?: boolean;
  onReload: () => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (commentId: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteComment(commentId);
      onReload();
    });
  };

  return (
    <div className="group rounded-xl border border-charcoal-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800/80">
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
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="rounded p-1 text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-600 dark:hover:bg-charcoal-700 dark:hover:text-charcoal-300"
            title="답글"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          {isAdmin && (
            <button
              onClick={() => handleDelete(comment.id)}
              disabled={isPending}
              className="rounded p-1 text-charcoal-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="삭제"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal-700 dark:text-charcoal-300">
        {comment.content}
      </p>

      {showReplyForm && (
        <ReplyForm
          postSlug={postSlug}
          parentId={comment.id}
          onSubmitted={() => {
            setShowReplyForm(false);
            onReload();
          }}
          onCancel={() => setShowReplyForm(false)}
        />
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-charcoal-100 pl-4 dark:border-charcoal-700">
          {replies.map((reply) => (
            <div key={reply.id} className="group/reply">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal-100 text-xs font-bold text-charcoal-600 dark:bg-charcoal-700 dark:text-charcoal-300">
                    {reply.author.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-charcoal-900 dark:text-charcoal-100">
                    {reply.author}
                  </span>
                  <span className="text-xs text-charcoal-400 dark:text-charcoal-500">
                    {timeAgo(reply.created_at)}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(reply.id)}
                    disabled={isPending}
                    className="rounded p-1 text-charcoal-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover/reply:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="삭제"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal-600 dark:text-charcoal-400">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, Comment[]>();
  comments
    .filter((c) => c.parent_id)
    .forEach((c) => {
      const list = repliesMap.get(c.parent_id!) || [];
      list.push(c);
      repliesMap.set(c.parent_id!, list);
    });

  return (
    <section className="mt-12 border-t border-charcoal-200 pt-8 dark:border-charcoal-800">
      <h2 className="mb-6 text-xl font-bold text-charcoal-900 dark:text-charcoal-100">
        댓글{" "}
        {!loading && comments.length > 0 && (
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
      ) : topLevel.length === 0 ? (
        <div className="py-8 text-center text-sm text-charcoal-500 dark:text-charcoal-400">
          아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesMap.get(comment.id) || []}
              postSlug={postSlug}
              isAdmin={isAdmin}
              onReload={loadComments}
            />
          ))}
        </div>
      )}
    </section>
  );
}
