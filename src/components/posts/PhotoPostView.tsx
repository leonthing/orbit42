"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { likePostAction, reportPostAction } from "@/lib/posts-actions";
import { blockUser } from "@/lib/blocks-actions";
import { PostBody } from "@/components/posts/PostBody";
import { PostOwnerMenu } from "@/components/posts/PostOwnerMenu";

export type WebPhoto = { id: string; url: string | null; width: number; height: number; caption?: string | null };
export type WebPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublic: boolean;
  hidden: boolean;
  photos: WebPhoto[];
  likeCount: number;
  liked: boolean;
  createdAt: string;
  /** "수정됨" 기준 시각(없으면 표시 안 함) */
  editedAt?: string | null;
  pinned?: boolean;
  /** 공유 주소 */
  url: string;
  bookingUrl: string | null;
  author: { username: string; displayName: string | null };
};

const REASONS = ["스팸·광고", "불쾌하거나 부적절한 내용", "사칭·저작권 침해", "기타"];

/** 글·사진 상세 (1.10.0) — 사진 넘겨 보기, 제목·본문, ❤️, 예약하기, ⋯ 신고·차단 */
export function PhotoPostView({
  post,
  loggedIn,
  isOwner,
  publicOpen,
}: {
  post: WebPost;
  loggedIn: boolean;
  isOwner: boolean;
  /** 공개 스위치(POSTS_PUBLIC) — 꺼져 있으면 링크를 받은 사람이 아직 못 연다 */
  publicOpen: boolean;
}) {
  const router = useRouter();
  const name = post.author.displayName || post.author.username;
  const [page, setPage] = useState(0);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likeCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const track = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르면 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(post.photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setPage(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
  };

  const ratio = post.photos[0] ? Math.min(Math.max(post.photos[0].width / Math.max(post.photos[0].height, 1), 0.8), 1.91) : 1;

  const toggleLike = () => {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/${post.author.username}/blog/${post.slug}`)}`);
      return;
    }
    const want = !liked;
    setLiked(want);
    setLikes((n) => n + (want ? 1 : -1));
    start(async () => {
      const r = await likePostAction(post.id, want);
      if ("error" in r) {
        setLiked(!want);
        setLikes((n) => n + (want ? -1 : 1));
        setNotice(r.error);
      } else {
        setLiked(r.liked);
        setLikes(r.likeCount);
      }
    });
  };

  const report = (reason: string) => {
    setReporting(false);
    start(async () => {
      const r = await reportPostAction(post.id, reason);
      setNotice("error" in r ? r.error : "신고가 접수됐어요. 운영자가 24시간 안에 확인할게요. 더 보고 싶지 않으면 차단할 수도 있어요.");
    });
  };

  const block = () => {
    setMenuOpen(false);
    if (!window.confirm(`${name}님을 차단할까요? 서로 팔로우가 해제되고, 서로의 글·대화·예약이 막혀요.`)) return;
    start(async () => {
      const r = await blockUser(post.author.username);
      if (r && "error" in r && r.error) setNotice(r.error);
      else router.push(`/${post.author.username}`);
    });
  };

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    // 휴대폰은 공유 시트, 데스크톱은 주소 복사
    if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await nav.share({ title: post.title || `${name}님의 글`, url: post.url });
        return;
      } catch {
        /* 닫으면 아무것도 안 함 */
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(post.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("주소를 복사해 주세요", post.url);
    }
  };

  const date = new Date(post.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", year: "numeric" });

  return (
    <article className="mx-auto w-full max-w-2xl space-y-5 max-md:pb-[var(--mobile-nav-pb)]">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={isOwner ? `/${post.author.username}/blog` : `/${post.author.username}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-100 max-md:-ml-2 max-md:px-2"
        >
          ← {isOwner ? "내 글·사진" : name}
        </Link>
        <div className="relative" ref={menuRef}>
          {isOwner ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/${post.author.username}/blog/photo/${post.id}/edit`}
                className="inline-flex min-h-11 items-center rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-4 text-xs font-medium text-charcoal-200 hover:border-charcoal-700 hover:text-charcoal-50"
              >
                고치기
              </Link>
              {!post.hidden && <PostOwnerMenu variant="inline" username={post.author.username} postId={post.id} isPublic={post.isPublic} pinned={!!post.pinned} />}
            </div>
          ) : loggedIn ? (
            <button
              type="button"
              aria-label="더보기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-300 hover:bg-charcoal-900/60 hover:text-charcoal-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          ) : null}
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-950 shadow-lg">
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setReporting(true);
                }}
                className="block min-h-11 w-full px-4 text-left text-sm text-red-400 hover:bg-charcoal-900"
              >
                신고하기
              </button>
              <button role="menuitem" type="button" onClick={block} className="block min-h-11 w-full px-4 text-left text-sm text-red-400 hover:bg-charcoal-900">
                {name}님 차단하기
              </button>
            </div>
          )}
        </div>
      </div>

      {post.hidden && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          운영 정책으로 숨겨진 글이에요. 다른 사람에게는 보이지 않아요.
        </p>
      )}

      {post.photos.length > 0 && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-900/40" style={{ aspectRatio: String(ratio) }}>
            <div
              ref={track}
              onScroll={onScroll}
              className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="사진"
            >
              {post.photos.map((p, i) => (
                <div key={p.id} className="h-full w-full shrink-0 snap-center">
                  {p.url ? (
                    // 서명 URL(1시간) — next/image 최적화를 거치지 않는다
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={p.caption || `사진 ${i + 1} / ${post.photos.length}`} className="h-full w-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-charcoal-500">사진을 불러오지 못했어요</div>
                  )}
                </div>
              ))}
            </div>
            {post.photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="이전 사진"
                  onClick={() => go(page - 1)}
                  disabled={page === 0}
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="다음 사진"
                  onClick={() => go(page + 1)}
                  disabled={page >= post.photos.length - 1}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0"
                >
                  ›
                </button>
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-2xs font-semibold text-white">
                  {page + 1} / {post.photos.length}
                </span>
              </>
            )}
          </div>
          {post.photos[page]?.caption && (
            <p className="text-center text-xs leading-relaxed text-charcoal-300" aria-live="polite" data-testid="photoCaption">
              {post.photos[page].caption}
            </p>
          )}
          {post.photos.length > 1 && (
            <div className="flex justify-center gap-1.5" aria-hidden>
              {post.photos.map((p, i) => (
                <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${i === page ? "bg-navy-400" : "bg-charcoal-700"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-charcoal-400">
          <span className="font-semibold text-charcoal-100">{name}</span>
          <span>@{post.author.username}</span>
          <span>· {date}</span>
          {post.editedAt && (
            <span title={new Date(post.editedAt).toLocaleString("ko-KR")} data-testid="edited">
              · 수정됨
            </span>
          )}
          {post.pinned && <span className="text-charcoal-300">· 📌 고정</span>}
          {!post.isPublic && <span className="rounded bg-charcoal-800/60 px-1.5 py-0.5 text-2xs text-charcoal-300">나만 보기</span>}
        </p>
        {post.title && <h1 className="text-2xl font-bold tracking-tight text-charcoal-50 md:text-3xl">{post.title}</h1>}
        <PostBody text={post.body} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleLike}
          disabled={pending || (isOwner && !post.isPublic)}
          aria-pressed={liked}
          aria-label={liked ? "하트 취소" : "하트"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal-800/60 bg-charcoal-900/40 px-4 text-sm font-medium text-charcoal-100 hover:border-charcoal-700 disabled:opacity-60"
        >
          <span className={liked ? "text-pink-500" : "text-charcoal-300"} aria-hidden>
            {liked ? "♥" : "♡"}
          </span>
          <span className="tabular-nums">{likes}</span>
        </button>
        {post.isPublic && !post.hidden && (
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal-800/60 bg-charcoal-900/40 px-4 text-sm font-medium text-charcoal-100 hover:border-charcoal-700"
            data-testid="sharePost"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
              <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
            </svg>
            {copied ? "복사했어요" : "링크 복사"}
          </button>
        )}
      </div>
      {post.isPublic && !post.hidden && !publicOpen && (isOwner || copied) && (
        <p className="-mt-2 text-xs text-charcoal-500">공개 전이라 다른 사람에게는 아직 안 열려요.</p>
      )}

      {!isOwner && post.bookingUrl && (
        <a
          href={post.bookingUrl}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-400"
        >
          {name}님에게 예약하기
        </a>
      )}

      {reporting && (
        <div role="dialog" aria-modal="true" aria-label="신고 사유" className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setReporting(false)}>
          <div className="w-full max-w-sm space-y-2 rounded-2xl border border-charcoal-800/60 bg-charcoal-950 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-charcoal-50">신고 사유를 골라 주세요</p>
            <p className="text-xs text-charcoal-400">운영자가 24시간 안에 확인하고 조치해요.</p>
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => report(r)} className="block min-h-11 w-full rounded-lg border border-charcoal-800/60 px-4 text-left text-sm text-charcoal-100 hover:bg-charcoal-900">
                {r}
              </button>
            ))}
            <button type="button" onClick={() => setReporting(false)} className="block min-h-11 w-full rounded-lg px-4 text-sm text-charcoal-400 hover:text-charcoal-100">
              취소
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/60 px-4 py-3 text-sm text-charcoal-100">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-3 text-xs text-charcoal-400 underline">
            닫기
          </button>
        </div>
      )}
    </article>
  );
}
