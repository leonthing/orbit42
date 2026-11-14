import Link from "next/link";
import { PostOwnerMenu } from "@/components/posts/PostOwnerMenu";

export type GridPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublic: boolean;
  hidden: boolean;
  photoCount: number;
  coverUrl: string | null;
  /** 링크 페이지 맨 위 고정 글 */
  pinned?: boolean;
  /** 한 번도 공개하지 않은 임시 저장 글 */
  draft?: boolean;
};

/** 글·사진 칸 그리드(1.10.0) — 3열 정사각. 첫 사진, 사진이 없으면 글자 카드. 서명 URL은 1시간짜리 */
export function PhotoPostGrid({
  username,
  posts,
  tileStyle,
  textColor,
  owner = false,
}: {
  username: string;
  posts: GridPost[];
  /** 내 목록 — 칸마다 ⋯ 메뉴(공개 전환·고정) */
  owner?: boolean;
  /** 링크 페이지 테마 색(인라인) — 없으면 앱 기본 색 */
  tileStyle?: React.CSSProperties;
  textColor?: string;
}) {
  return (
    <ul className="grid grid-cols-3 gap-1">
      {posts.map((p) => {
        const label = p.title || p.body.slice(0, 40) || "사진 글";
        return (
          <li key={p.id} className="relative">
            <Link
              href={`/${username}/blog/${encodeURIComponent(p.slug)}`}
              aria-label={label}
              className={`relative block aspect-square overflow-hidden rounded-md ${tileStyle ? "" : "bg-charcoal-900/60"}`}
              style={tileStyle}
            >
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className={`line-clamp-5 p-2 text-left text-xs ${textColor ? "" : "text-charcoal-200"}`} style={textColor ? { color: textColor } : undefined}>
                  {label}
                </span>
              )}
              <span className="absolute right-1.5 top-1.5 flex gap-1 text-2xs font-semibold text-white drop-shadow">
                {p.pinned && <span aria-label="고정됨">📌</span>}
                {p.photoCount > 1 && <span aria-label={`사진 ${p.photoCount}장`}>⧉</span>}
                {p.draft ? (
                  <span className="rounded bg-black/60 px-1">임시 저장</span>
                ) : (
                  !p.isPublic && <span aria-label="나만 보기">🔒</span>
                )}
                {p.hidden && <span aria-label="숨겨짐">⊘</span>}
              </span>
            </Link>
            {owner && <PostOwnerMenu username={username} postId={p.id} isPublic={p.isPublic} pinned={!!p.pinned} />}
          </li>
        );
      })}
    </ul>
  );
}

/** ApiPost(목록) → 그리드 칸 */
export function toGridPost(p: {
  id: string;
  slug: string;
  title: string;
  body: string;
  visibility: string;
  hidden: boolean;
  photoCount: number;
  photos: { url: string | null }[];
  pinned?: boolean;
  publishedAt?: string | null;
}): GridPost {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    body: p.body,
    isPublic: p.visibility === "public",
    hidden: p.hidden,
    photoCount: p.photoCount,
    coverUrl: p.photos[0]?.url ?? null,
    pinned: !!p.pinned,
    draft: p.visibility !== "public" && !p.publishedAt,
  };
}
