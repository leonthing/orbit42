"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { pinPostAction, updatePostAction } from "@/lib/posts-actions";

/**
 * 내 글 ⋯ 메뉴(1.10.0) — 목록 칸·상세에서 같은 것: 고치기, 공개 ↔ 나만 보기, 링크 페이지 맨 위에 고정/풀기.
 * variant 'tile' 은 그리드 칸 오른쪽 아래에 겹쳐 그린다.
 */
export function PostOwnerMenu({
  username,
  postId,
  isPublic,
  pinned,
  variant = "tile",
}: {
  username: string;
  postId: string;
  isPublic: boolean;
  pinned: boolean;
  variant?: "tile" | "inline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const run = (fn: () => Promise<{ error?: string } | object>) => {
    setOpen(false);
    start(async () => {
      const r = (await fn()) as { error?: string };
      if (r && "error" in r && r.error) setMsg(r.error);
      else {
        setMsg(null);
        router.refresh();
      }
    });
  };

  const item = "block min-h-11 w-full px-4 text-left text-sm text-charcoal-100 hover:bg-charcoal-900 disabled:opacity-50";
  return (
    <div ref={ref} className={variant === "tile" ? "absolute bottom-0 right-0 z-10" : "relative"}>
      <button
        type="button"
        aria-label="글 메뉴"
        aria-expanded={open}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          variant === "tile"
            ? "flex h-11 w-11 items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            : "flex h-11 w-11 items-center justify-center rounded-full text-charcoal-300 hover:bg-charcoal-900/60 hover:text-charcoal-50"
        }
        data-testid="postMenu"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        // 휴대폰은 화면 아래 시트(칸 위치와 상관없이 화면 안), 넓은 화면은 칸 옆 메뉴
        <div
          role="menu"
          className={`z-50 overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-950 shadow-lg max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(var(--mobile-nav-pb)+0.5rem)] md:absolute md:right-0 md:w-60 ${variant === "tile" ? "md:bottom-12" : "md:mt-1"}`}
        >
          {variant === "tile" && (
            <Link role="menuitem" href={`/${username}/blog/photo/${postId}/edit`} className={`${item} flex items-center`}>
              고치기
            </Link>
          )}
          <button role="menuitem" type="button" className={item} onClick={() => run(() => updatePostAction(postId, { public: !isPublic }))}>
            {isPublic ? "나만 보기로 바꾸기" : "전체 공개로 바꾸기"}
          </button>
          <button
            role="menuitem"
            type="button"
            className={item}
            disabled={!isPublic && !pinned}
            onClick={() => run(() => pinPostAction(postId, !pinned))}
          >
            {pinned ? "링크 페이지 고정 풀기" : isPublic ? "링크 페이지 맨 위에 고정" : "공개 글만 고정할 수 있어요"}
          </button>
        </div>
      )}
      {msg && (
        <p role="alert" className="absolute bottom-12 right-0 z-30 w-56 rounded-lg bg-red-950 px-3 py-2 text-xs text-red-200">
          {msg}
        </p>
      )}
    </div>
  );
}
