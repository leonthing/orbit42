import Link from "next/link";
import { ShareMenu } from "@/components/ShareMenu";
import { FollowButton } from "./FollowButton";
import type { SocialLinks } from "@/lib/auth";

/**
 * 링크트리형 공개 프로필 — SNS 바이오에 걸어두는 "얼굴" 화면.
 *
 * 중앙 정렬 아바타 → 이름 → 소개 → 소셜 아이콘 → 예약 카드 스택 → 가입 CTA.
 * 방문자(비소유자)에게만 보이고, 소유자는 기존 대시보드를 그대로 쓴다.
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

const SOCIAL_META: Record<
  string,
  { label: string; path: (v: string) => string; icon: React.ReactNode }
> = {
  instagram: {
    label: "Instagram",
    path: (v) => v,
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
    path: (v) => v,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    path: (v) => v,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    path: (v) => v,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    path: (v) => v,
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
  /** 신뢰 신호 — 호스트 평점과 누적 예약 */
  rating: { average: number; count: number } | null;
  totalBookings: number;
}) {
  const socials = Object.entries(SOCIAL_META)
    .map(([key, meta]) => {
      const raw = (socialLinks as Record<string, string | undefined>)[key];
      return raw ? { key, meta, url: meta.path(raw) } : null;
    })
    .filter(Boolean) as Array<{
    key: string;
    meta: (typeof SOCIAL_META)[string];
    url: string;
  }>;

  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8 text-center">
      {/* 아바타 */}
      <div className="flex justify-center">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-2 ring-navy-500/30"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-navy-500/20 text-3xl font-bold text-navy-400">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <h1 className="mt-4 text-2xl font-bold text-charcoal-100">{displayName}</h1>
      <p className="mt-0.5 text-sm text-charcoal-500">@{username}</p>

      {bio && (
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-charcoal-300">
          {bio}
        </p>
      )}

      {interests.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {interests.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-navy-500/12 px-2.5 py-1 text-xs font-medium text-navy-400"
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-800/60 text-charcoal-200 transition-colors hover:bg-navy-500/20 hover:text-navy-400"
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
      {(rating || totalBookings > 0) && (
        <div className="mt-4 flex justify-center gap-4 text-xs text-charcoal-500">
          {rating && rating.count > 0 && (
            <span>
              <span className="text-amber-400">★</span>{" "}
              <strong className="text-charcoal-200">{rating.average.toFixed(1)}</strong> 후기{" "}
              {rating.count}
            </span>
          )}
          {totalBookings > 0 && (
            <span>
              누적 예약 <strong className="text-charcoal-200">{totalBookings}</strong>회
            </span>
          )}
        </div>
      )}

      {/* 예약 — 이 페이지의 본론. DM 대신 시간을 잡게 한다 */}
      <div className="mt-8 space-y-3">
        {slots.length > 0 && (
          <div className="flex items-center justify-center gap-2 pb-1">
            <span className="h-px flex-1 bg-charcoal-800/60" />
            <p className="text-xs font-semibold text-charcoal-400">
              DM 대신, 시간을 예약하세요
            </p>
            <span className="h-px flex-1 bg-charcoal-800/60" />
          </div>
        )}
        {slots.map((slot) => (
          <Link
            key={slot.slug}
            href={`/${username}/s/${slot.slug}`}
            className="block rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy-500/50"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-charcoal-100">
                  {slot.title}
                </p>
                <p className="mt-0.5 text-xs text-charcoal-500">
                  {slot.duration_min}분 · {priceLabel(slot)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-navy-500 px-3.5 py-1.5 text-xs font-semibold text-white">
                예약
              </span>
            </div>
          </Link>
        ))}

        {hasPublicCalendar && (
          <LinkCard
            href={`/${username}/c`}
            label="캘린더 보기"
            sub="언제 시간이 나는지 확인하기"
          />
        )}
        {hasPosts && (
          <LinkCard href={`/${username}/blog`} label="블로그" sub="글 읽어보기" />
        )}
        {slots.length === 0 && (
          <p className="rounded-2xl border border-dashed border-charcoal-800/60 px-5 py-8 text-sm text-charcoal-500">
            아직 열어둔 시간이 없어요.
          </p>
        )}

        {/* 맞는 시간이 없을 때 — 조율은 앱 안에서 */}
        <Link
          href={loggedIn ? `/${username}?request=1` : `/signup?ref=${username}`}
          className="block rounded-2xl border border-navy-500/30 bg-navy-500/8 px-5 py-4 text-left transition-colors hover:bg-navy-500/15"
        >
          <p className="text-[15px] font-semibold text-navy-400">시간 요청하기</p>
          <p className="mt-0.5 text-xs text-charcoal-500">
            원하는 시간이 없나요? 일정을 제안하면 알림으로 전달돼요.
          </p>
        </Link>
      </div>

      {/* 가입 CTA — Linktree 의 join 버튼과 같은 자리 */}
      {!loggedIn && (
        <Link
          href={`/signup?ref=${username}`}
          className="mt-10 inline-block rounded-full bg-charcoal-100 px-6 py-3 text-sm font-bold text-charcoal-950 transition-transform hover:scale-[1.02]"
        >
          나도 예약 링크 만들기
        </Link>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-charcoal-600">
        <Link href="/" className="font-semibold hover:text-charcoal-400">
          orbit42
        </Link>{" "}
        · 링크 하나로 내 시간을 예약받고, 쓴 시간을 자산으로 관리해요
      </p>
    </div>
  );
}

function LinkCard({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy-500/50"
    >
      <p className="text-[15px] font-semibold text-charcoal-100">{label}</p>
      <p className="mt-0.5 text-xs text-charcoal-500">{sub}</p>
    </Link>
  );
}
