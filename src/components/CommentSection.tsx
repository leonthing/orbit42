"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { CommentNode } from "@/lib/comments";
import { addComment, deleteComment, listComments } from "@/lib/comments";
import { toggleReaction } from "@/lib/reactions";
import { getReactionsForMany } from "@/lib/reactions";
import type { ReactionSummary } from "@/lib/reactions-types";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간`;
  const d = Math.floor(h / 24);
  return `${d}일`;
}

export function CommentSection({
  targetType,
  targetId,
  loggedIn,
  viewerId,
}: {
  targetType: "feed_post" | "blog_post";
  targetId: string;
  loggedIn: boolean;
  viewerId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentNode[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [reactions, setReactions] = useState<Map<string, ReactionSummary[]>>(
    new Map(),
  );

  // Eager-load count (cheap: one tree fetch); expand on click for detail.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listComments(targetType, targetId);
      if (cancelled) return;
      setComments(list);
      setCount(countAll(list));
      const ids = allIds(list);
      if (ids.length > 0) {
        const r = await getReactionsForMany("comment", ids);
        if (!cancelled) setReactions(r);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const refetch = async () => {
    const list = await listComments(targetType, targetId);
    setComments(list);
    setCount(countAll(list));
    const ids = allIds(list);
    const r = ids.length > 0 ? await getReactionsForMany("comment", ids) : new Map();
    setReactions(r);
  };

  const onLike = async (commentId: string) => {
    await toggleReaction("comment", commentId, "❤️");
    const r = await getReactionsForMany("comment", allIds(comments ?? []));
    setReactions(r);
  };

  return (
    <div className="mt-3 border-t border-charcoal-800/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-200"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
        </svg>
        댓글
        {count !== null && count > 0 && (
          <span className="font-semibold text-charcoal-300">{count}</span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loggedIn ? (
            <CommentForm
              targetType={targetType}
              targetId={targetId}
              onPosted={refetch}
            />
          ) : (
            <p className="text-xs text-charcoal-500">
              <Link href="/login" className="text-red-400 hover:text-red-300">
                로그인
              </Link>{" "}
              후 댓글을 남길 수 있어요.
            </p>
          )}

          {comments === null ? (
            <p className="text-xs text-charcoal-500">로딩…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-charcoal-500">첫 댓글을 남겨보세요.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  node={c}
                  targetType={targetType}
                  targetId={targetId}
                  viewerId={viewerId}
                  loggedIn={loggedIn}
                  reactions={reactions}
                  onLike={onLike}
                  onChange={refetch}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function countAll(nodes: CommentNode[]): number {
  let n = 0;
  for (const c of nodes) {
    n += 1 + countAll(c.replies);
  }
  return n;
}
function allIds(nodes: CommentNode[]): string[] {
  const out: string[] = [];
  const walk = (arr: CommentNode[]) => {
    for (const c of arr) {
      out.push(c.id);
      walk(c.replies);
    }
  };
  walk(nodes);
  return out;
}

function CommentForm({
  targetType,
  targetId,
  parentId = null,
  onPosted,
  onCancel,
  autoFocus = false,
  placeholder = "댓글을 남겨보세요…",
}: {
  targetType: "feed_post" | "blog_post";
  targetId: string;
  parentId?: string | null;
  onPosted: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || pending) return;
    start(async () => {
      const res = await addComment(targetType, targetId, body, parentId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setBody("");
      setError(null);
      onPosted();
      onCancel?.();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={parentId ? 2 : 1}
        className="w-full resize-none rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-700 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-charcoal-500 hover:text-charcoal-200"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!body.trim() || pending}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          {pending ? "…" : parentId ? "답글" : "등록"}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  node,
  targetType,
  targetId,
  viewerId,
  loggedIn,
  reactions,
  onLike,
  onChange,
  depth = 0,
}: {
  node: CommentNode;
  targetType: "feed_post" | "blog_post";
  targetId: string;
  viewerId: string | null;
  loggedIn: boolean;
  reactions: Map<string, ReactionSummary[]>;
  onLike: (id: string) => void;
  onChange: () => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const mine = viewerId === node.author.id;
  const heart = reactions.get(node.id)?.find((r) => r.emoji === "❤️");
  const confirm = useConfirm();

  return (
    <li className={depth === 0 ? "" : "ml-6"}>
      <div className="flex items-start gap-2">
        <Link href={`/${node.author.username}`}>
          <Avatar
            url={node.author.avatar_url}
            name={node.author.display_name || node.author.username}
            size={28}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/${node.author.username}`}
              className="text-xs font-semibold text-charcoal-100 hover:underline"
            >
              {node.author.display_name || node.author.username}
            </Link>
            <span className="text-[10px] text-charcoal-500">
              {relTime(node.created_at)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-charcoal-200">
            {node.body}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            {loggedIn && (
              <button
                type="button"
                onClick={() => onLike(node.id)}
                className={`inline-flex items-center gap-0.5 hover:text-charcoal-200 ${
                  heart?.by_me ? "text-red-400" : "text-charcoal-500"
                }`}
              >
                <span>❤️</span>
                {(heart?.count ?? 0) > 0 && <span>{heart?.count}</span>}
              </button>
            )}
            {loggedIn && depth === 0 && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="text-charcoal-500 hover:text-charcoal-200"
              >
                답글
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: "이 댓글을 삭제할까요?",
                    confirmLabel: "삭제",
                    danger: true,
                  });
                  if (ok) {
                    await deleteComment(node.id);
                    onChange();
                  }
                }}
                className="text-charcoal-500 hover:text-red-400"
              >
                삭제
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-2">
              <CommentForm
                targetType={targetType}
                targetId={targetId}
                parentId={node.id}
                onPosted={onChange}
                onCancel={() => setReplying(false)}
                autoFocus
                placeholder={`@${node.author.username}에게 답글…`}
              />
            </div>
          )}

          {node.replies.length > 0 && (
            <ul className="mt-3 space-y-3">
              {node.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  node={r}
                  targetType={targetType}
                  targetId={targetId}
                  viewerId={viewerId}
                  loggedIn={loggedIn}
                  reactions={reactions}
                  onLike={onLike}
                  onChange={onChange}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
