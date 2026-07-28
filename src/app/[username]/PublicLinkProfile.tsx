import Link from "next/link";
import { ShareMenu } from "@/components/ShareMenu";
import { FollowButton } from "./FollowButton";
import type { SocialLinks } from "@/lib/auth";
import { resolveLinkTheme } from "@/lib/link-themes";

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

const SOCIAL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  instagram: {
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  x: {
    label: "X",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.4 8.65 22 11 22 14.2V21h-4v-6c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21h-4V9Z" />
      </svg>
    ),
  },
};

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
  profileUrl,
  loggedIn,
  viewerFollowing,
  rating,
  totalBookings,
  themeKey,
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
  profileUrl: string;
  loggedIn: boolean;
  viewerFollowing: boolean;
  rating: { average: number; count: number } | null;
  totalBookings: number;
  themeKey: string | null;
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
    <div style={{ color: theme.text }}>
      {/* 배경 — 화면 전체를 덮는 고정 레이어. 셸 여백·하단 링크 뒤까지 칠해진다. */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: theme.background }}
        aria-hidden
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

        {socials.length > 0 && (
          <div className="mt-4 flex justify-center gap-3">
            {socials.map(({ key, meta, url }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={meta.label}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                style={{ backgroundColor: theme.surface }}
              >
                {meta.icon}
              </a>
            ))}
          </div>
        )}

        {/* 액션 (팔로우 · 공유) */}
        <div className="mt-5 flex justify-center gap-2">
          <FollowButton
            targetUsername={username}
            initiallyFollowing={viewerFollowing}
            loggedIn={loggedIn}
          />
          <ShareMenu
            url={profileUrl}
            title={`${displayName} (@${username}) | Orbit42`}
            text={bio || `${displayName}님의 시간을 Orbit42에서 예약해보세요`}
            compact
          />
        </div>

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
              className="block rounded-2xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
              style={cardStyle}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{slot.title}</p>
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
              className="rounded-2xl border border-dashed px-5 py-8 text-sm"
              style={{ borderColor: theme.border, color: theme.muted }}
            >
              아직 열어둔 시간이 없어요.
            </p>
          )}

          {/* 맞는 시간이 없을 때 — 조율은 앱 안에서 */}
          <Link
            href={loggedIn ? `/${username}?request=1` : `/signup?ref=${username}`}
            className="block rounded-2xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
            style={cardStyle}
          >
            <p className="text-[15px] font-semibold" style={{ color: theme.accent }}>
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
              label="블로그"
              sub="글 읽어보기"
              style={cardStyle}
              muted={theme.muted}
            />
          )}
        </div>

        {/* 가입 CTA */}
        {!loggedIn && (
          <Link
            href={`/signup?ref=${username}`}
            className="mt-10 inline-block rounded-full px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: theme.accent, color: theme.onAccent }}
          >
            나도 예약 링크 만들기
          </Link>
        )}

        <p className="mt-6 text-[11px] leading-relaxed" style={{ color: theme.muted }}>
          <Link href="/" className="font-semibold">
            orbit42
          </Link>{" "}
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
      className="block rounded-2xl border px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
      style={style}
    >
      <p className="text-[15px] font-semibold">{label}</p>
      <p className="mt-0.5 text-xs" style={{ color: muted }}>
        {sub}
      </p>
    </Link>
  );
}
