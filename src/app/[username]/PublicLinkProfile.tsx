import Link from "next/link";
import { LineIcon } from "@/components/LineIcon";
import { AppStoreAwareLink } from "@/components/AppStoreAwareLink";
import { FollowButton } from "./FollowButton";
import type { SocialLinks } from "@/lib/auth";
import { SOCIAL_ICONS } from "@/components/SocialIcon";
import { resolveLinkTheme } from "@/lib/link-themes";
import type { CustomLink } from "@/lib/custom-links";
import { PhotoPostGrid, type GridPost } from "@/components/posts/PhotoPostGrid";

/**
 * 링크트리형 공개 프로필 — SNS 바이오에 걸어두는 "얼굴" 화면.
 *
 * 중앙 정렬 아바타 → 이름 → 소개 → 소셜 아이콘 → 예약 카드 스택 → 가입 CTA.
 * 색은 사용자가 고른 테마(users.link_theme)를 인라인으로 입혀, 다크/라이트
 * 모드와 무관하게 방문자에게 항상 같은 얼굴로 보이게 한다.
 */

type PublicSlot = {
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  pricing_model: string;
  current_high_bid_cents: number | null;
  reserve_price_cents: number | null;
};

// 아이콘은 프로필 소셜 줄과 함께 쓰는 components/SocialIcon 에서(모양 그대로). 이름은 이 화면 그대로 영문.
const SOCIAL_META: Record<string, { label: string; icon: React.ReactNode }> = Object.fromEntries(
  (["instagram", "x", "youtube", "facebook", "linkedin"] as const).map((k) => [
    k,
    { label: ({ instagram: "Instagram", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn" } as const)[k], icon: SOCIAL_ICONS[k].icon },
  ]),
);

function priceLabel(slot: PublicSlot) {
  if (slot.pricing_model === "auction") {
    const bid = slot.current_high_bid_cents ?? slot.reserve_price_cents ?? 0;
    return `경매 · ₩${Math.round(bid / 100).toLocaleString("ko-KR")}`;
  }
  return slot.price_cents === 0
    ? "무료"
    : `₩${Math.round(slot.price_cents / 100).toLocaleString("ko-KR")}`;
}

export function PublicLinkProfile({
  username,
  displayName,
  avatarUrl,
  bio,
  interests,
  socialLinks,
  slots,
  hasPublicCalendar,
  hasPosts,
  postsLabel = "블로그",
  loggedIn,
  viewerFollowing,
  rating,
  totalBookings,
  themeKey,
  canvas,
  customLinks = [],
  photoPosts = [],
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  interests: string[];
  socialLinks: SocialLinks;
  slots: PublicSlot[];
  hasPublicCalendar: boolean;
  hasPosts: boolean;
  /** 1.10.0 통합 뒤 '글·사진' */
  postsLabel?: string;
  loggedIn: boolean;
  viewerFollowing: boolean;
  rating: { average: number; count: number } | null;
  totalBookings: number;
  themeKey: string | null;
  /** 앱 화면(AppShell) 안에서 그릴 때 테마 바탕을 직접 깐다 — 주인의 '내 공개 페이지 보기'(로그인 안 한 손님 기준이라 loggedIn=false) */
  canvas?: boolean;
  /** 호스트가 고른 직접 링크 (개선-46) — 이미 http/https 만 걸러져 온다 */
  customLinks?: CustomLink[];
  /** 글·사진(1.10.0) 최근 공개 글 6개 — 볼 수 없거나 0개면 빈 배열(칸 없음) */
  photoPosts?: GridPost[];
}) {
  const theme = resolveLinkTheme(themeKey);
  const socials = Object.entries(SOCIAL_META)
    .map(([key, meta]) => {
      const raw = (socialLinks as Record<string, string | undefined>)[key];
      return raw ? { key, meta, url: raw } : null;
    })
    .filter(Boolean) as Array<{
    key: string;
    meta: (typeof SOCIAL_META)[string];
    url: string;
  }>;

  const cardStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
  };

  return (
    <div
      // 로그인한 방문자는 앱 셸(사이드바·탭 바) 안에서 보므로 셸 배경이 html 캔버스를 덮는다 →
      // 이 영역에 직접 테마 캔버스를 칠하고, 셸 안쪽 여백(px-4 py-4 sm:px-5 md:px-6 md:py-5)만큼 넓혀 테두리가 안 보이게.
      // (전엔 라이트 모드에서 어두운 테마의 밝은 글자가 흰 바탕에 놓여 이름·소개가 안 보였다)
      className={loggedIn ? "-mx-4 -my-4 min-h-[calc(100%+2rem)] px-4 py-4 sm:-mx-5 sm:px-5 md:-mx-6 md:-my-5 md:min-h-[calc(100%+2.5rem)] md:px-6 md:py-5" : undefined}
      style={{ color: theme.text, ...(loggedIn || canvas ? { backgroundColor: theme.canvas } : {}) }}
    >
      {/*
        배경은 body 에 직접 칠한다. 고정 레이어(z-index)로는 셸 배경에 가려질 수
        있고, body 배경은 캔버스로 전파돼 스크롤·하단 링크 영역까지 항상 덮는다.
        이 페이지를 벗어나면 style 태그가 사라져 원래 배경으로 돌아온다.
      */}
      {/*
        배경은 html 단색 하나로 끝낸다. 그라디언트 오버레이를 얹으면 셸 여백만큼
        테두리처럼 보이고 높이도 어긋나므로, 스크롤 어디서나 같은 색이 되도록
        단색만 캔버스에 칠한다.
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `html{background:${theme.canvas} !important;--link-footer:color-mix(in srgb, ${theme.text} 72%, transparent);}body{background:transparent !important;}`,
        }}
      />
      <div className="mx-auto w-full max-w-lg text-center">
        {/* 아바타 */}
        <div className="flex justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 3px ${theme.surface}` }}
            />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
              style={{ backgroundColor: theme.surface, color: theme.accent }}
            >
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-bold">{displayName}</h1>
        <p className="mt-0.5 text-sm" style={{ color: theme.muted }}>
          @{username}
        </p>

        {bio && (
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ opacity: 0.9 }}>
            {bio}
          </p>
        )}

        {interests.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {interests.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: theme.surface, color: theme.muted }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 소셜: 누르는 영역 44px(11/21) — 보이는 동그라미 40px·간격(가운데끼리 52px)은 그대로 */}
        {socials.length > 0 && (
          <div className="-mb-0.5 mt-3.5 flex justify-center gap-2">
            {socials.map(({ key, meta, url }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={meta.label}
                title={meta.label}
                className="flex h-11 w-11 items-center justify-center transition-opacity hover:opacity-70"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: theme.surface }}>
                  {meta.icon}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* 액션 — 방문자의 시선이 예약 카드로 바로 가도록 버튼을 두지 않는다.
            로그인한 방문자에게만 팔로우를 보여주고, 공유는 브라우저 공유 기능으로. */}


        {/* 신뢰 신호 */}
        {((rating && rating.count > 0) || totalBookings > 0) && (
          <div
            className="mt-4 flex justify-center gap-4 text-xs"
            style={{ color: theme.muted }}
          >
            {rating && rating.count > 0 && (
              <span>
                ★ <strong style={{ color: theme.text }}>{rating.average.toFixed(1)}</strong>{" "}
                후기 {rating.count}
              </span>
            )}
            {totalBookings > 0 && (
              <span>
                누적 예약 <strong style={{ color: theme.text }}>{totalBookings}</strong>회
              </span>
            )}
          </div>
        )}

        {/* 예약 — 이 페이지의 본론 */}
        <div className="mt-8 space-y-3">
          {slots.length > 0 && (
            <div className="flex items-center justify-center gap-2 pb-1">
              <span className="h-px flex-1" style={{ backgroundColor: theme.border }} />
              <p className="text-xs font-semibold" style={{ color: theme.muted }}>
                DM 대신, 시간을 예약하세요
              </p>
              <span className="h-px flex-1" style={{ backgroundColor: theme.border }} />
            </div>
          )}

          {slots.map((slot) => (
            <Link
              key={slot.slug}
              href={`/${username}/s/${slot.slug}`}
              className="block rounded-xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
              style={cardStyle}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{slot.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: theme.muted }}>
                    {slot.duration_min}분 · {priceLabel(slot)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: theme.accent, color: theme.onAccent }}
                >
                  예약
                </span>
              </div>
            </Link>
          ))}

          {slots.length === 0 && (
            <p
              className="rounded-xl border border-dashed px-5 py-8 text-sm"
              style={{ borderColor: theme.border, color: theme.muted }}
            >
              아직 열어둔 시간이 없어요.
            </p>
          )}

          {/* 호스트가 고른 직접 링크 (개선-46) — 예약 링크 아래 버튼 줄, 새 탭 */}
          {customLinks.length > 0 && (
            <div className="space-y-2 pt-1" data-testid="custom-links">
              {customLinks.map((l, i) => (
                <a
                  key={`${i}-${l.url}`}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                  style={cardStyle}
                >
                  <span className="truncate">{l.title}</span>
                  <span aria-hidden style={{ color: theme.muted }}>↗</span>
                </a>
              ))}
            </div>
          )}

          {/* 맞는 시간이 없을 때 — 조율은 앱 안에서 */}
          <Link
            href={loggedIn ? `/${username}?request=1` : `/signup?ref=${username}`}
            className="block rounded-xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
            style={cardStyle}
          >
            <p className="text-sm font-semibold" style={{ color: theme.accent }}>
              시간 요청하기
            </p>
            <p className="mt-0.5 text-xs" style={{ color: theme.muted }}>
              원하는 시간이 없나요? 일정을 제안하면 알림으로 전달돼요.
            </p>
          </Link>

          {hasPublicCalendar && (
            <LinkCard
              href={`/${username}/c`}
              label="캘린더 보기"
              sub="언제 시간이 나는지 확인하기"
              style={cardStyle}
              muted={theme.muted}
            />
          )}
          {hasPosts && (
            <LinkCard
              href={`/${username}/blog`}
              label={postsLabel}
              sub="글 읽어보기"
              style={cardStyle}
              muted={theme.muted}
            />
          )}
        </div>

        {/* 글·사진 (1.10.0) — 예약 칸 아래. 공개 글이 없으면 칸을 그리지 않는다 */}
        {photoPosts.length > 0 && (
          <section className="mt-8 text-left" aria-labelledby="link-photo-posts">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="link-photo-posts" className="text-sm font-semibold">
                글·사진
              </h2>
              <Link href={`/${username}/blog`} className="inline-flex min-h-11 items-center text-xs font-medium" style={{ color: theme.accent }}>
                모두 보기 →
              </Link>
            </div>
            {photoPosts[0]?.pinned && (
              <Link
                href={`/${username}/blog/${encodeURIComponent(photoPosts[0].slug)}`}
                className="mb-2 flex min-h-11 items-stretch overflow-hidden rounded-xl"
                style={{ backgroundColor: theme.surface, color: theme.text }}
                data-testid="pinnedPost"
              >
                {photoPosts[0].coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPosts[0].coverUrl} alt="" className="h-24 w-24 shrink-0 object-cover" />
                )}
                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
                  <span className="text-2xs font-semibold" style={{ color: theme.accent }}>
                    <LineIcon name="pin" /> 고정한 글
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold">{photoPosts[0].title || photoPosts[0].body.replace(/[#>*_~`[\]()-]/g, "").slice(0, 60) || "사진 글"}</span>
                </span>
              </Link>
            )}
            <PhotoPostGrid
              username={username}
              posts={(photoPosts[0]?.pinned ? photoPosts.slice(1) : photoPosts).slice(0, 6)}
              tileStyle={{ backgroundColor: theme.surface }}
              textColor={theme.text}
            />
          </section>
        )}

        {/* 로그인한 방문자용 팔로우 — 예약이 먼저 보이도록 맨 아래에 둔다 */}
        {loggedIn && (
          <div className="mt-8 flex justify-center">
            <FollowButton
              targetUsername={username}
              initiallyFollowing={viewerFollowing}
              loggedIn
            />
          </div>
        )}

        <p className="mt-10 text-2xs leading-relaxed" style={{ color: theme.muted }}>
          <AppStoreAwareLink href="/" className="font-semibold">
            orbit42
          </AppStoreAwareLink>{" "}
          · 링크 하나로 내 시간을 예약받고, 쓴 시간을 자산으로 관리해요
        </p>
      </div>
    </div>
  );
}

function LinkCard({
  href,
  label,
  sub,
  style,
  muted,
}: {
  href: string;
  label: string;
  sub: string;
  style: React.CSSProperties;
  muted: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
      style={style}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs" style={{ color: muted }}>
        {sub}
      </p>
    </Link>
  );
}
