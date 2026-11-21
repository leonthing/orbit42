import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { PasswordForm } from "./PasswordForm";
import { ThemeSection } from "./ThemeSection";
import { AvatarUploader } from "./AvatarUploader";
import { isGoogleCalendarConnected } from "../calendar/actions";
import { listMyCalendars } from "@/lib/calendars";
import { listExtraGoogleAccounts } from "@/lib/google";
import { getUserId } from "@/lib/db";
import { GoogleAccountsSection } from "./GoogleAccountsSection";
import { MyCalendars } from "./MyCalendars";
import { LinkThemePicker } from "./LinkThemePicker";
import { WorkHoursForm } from "./WorkHoursForm";
import { getWorkHours } from "@/lib/insights";
import { LocationBuffersForm } from "./LocationBuffersForm";
import { listLocationBuffers } from "@/lib/location-buffers";
import { ReferralLink } from "./ReferralLink";
import { NotificationPrefs } from "./NotificationPrefs";
import { getMyPrefs } from "@/lib/notification-prefs";
import {
  VerifyEmailBanner,
  DeleteAccountSection,
} from "./AccountDangerZone";
import { SectionNav } from "./SectionNav";
import { PrivacySection } from "./PrivacySection";
import { listBlockedUsers } from "@/lib/blocks";
import { SettingsPhoneList } from "./SettingsPhoneList";
import { HashToTab } from "./HashToTab";
import Link from "next/link";
import { PaymentInstructionsForm } from "./PaymentInstructionsForm";
import { WeekStartPicker } from "./WeekStartPicker";
import { normalizeWeekStart } from "@/lib/week-start";
import { getAdminClient } from "@/lib/supabase";
import { IntegrationTokens } from "./IntegrationTokens";
import { listPersonalAccessTokens } from "@/lib/pat";
import { cardsOpenFor } from "@/lib/cards-access";

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

// 이름은 휴대폰 설정 목록·iOS 와 같은 말(11/21 묶음 나). 순서는 아래 섹션이 놓인 순서(스크롤 위치 표시가 따라감).
const SECTIONS = [
  { id: "profile", label: "프로필" },
  { id: "google", label: "Google 캘린더" },
  { id: "link-theme", label: "공개 링크 테마" },
  { id: "calendars", label: "내 캘린더" },
  { id: "work-hours", label: "근무시간" },
  { id: "payment", label: "결제 안내" },
  { id: "locations", label: "이동시간 버퍼" },
  { id: "people-import", label: "캘린더에서 사람 찾기" },
  { id: "referral", label: "친구 초대" },
  { id: "notifications", label: "알림 설정" },
  { id: "theme", label: "화면 모드" },
  { id: "integrations", label: "연동 토큰" },
  { id: "account", label: "계정" },
  { id: "privacy", label: "개인정보·안전" },
  { id: "danger", label: "계정 삭제" },
];

const GOOGLE_ERRORS: Record<string, string> = {
  google_missing_scopes:
    "캘린더 권한이 허용되지 않아 연결하지 않았어요. 다시 연결하면서 Google 화면의 항목을 모두 체크해 주세요.",
  google_auth_failed: "Google 연결에 실패했어요. 잠시 후 다시 시도해 주세요.",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams?: { error?: string; tab?: string };
}) {
  // 휴대폰: iOS 처럼 목록(탭 없음) → 하위 화면(?tab=구역). 구글 연결 오류로 돌아오면 Google 화면으로.
  const tab = searchParams?.tab ?? (searchParams?.error?.startsWith("google") ? "google" : undefined);
  const ph = (id: string) => (tab === id ? "" : "max-md:hidden");
  const googleError = GOOGLE_ERRORS[searchParams?.error ?? ""] ?? null;
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const userId = await getUserId();
  const [googleConnected, myCalendars, extras, notifPrefs, workHours, locationBuffers, patRows] =
    await Promise.all([
      isGoogleCalendarConnected().catch(() => false),
      listMyCalendars().catch(() => []),
      userId ? listExtraGoogleAccounts(userId) : Promise.resolve([]),
      getMyPrefs().catch(() => ({})),
      userId ? getWorkHours(userId) : Promise.resolve({}),
      listLocationBuffers(userId ?? undefined).catch(() => []),
      userId ? listPersonalAccessTokens(userId).catch(() => []) : Promise.resolve([]),
    ]);

  const { data: payRow } = userId
    ? await getAdminClient().from("users").select("payment_instructions, week_start, is_private").eq("id", userId).single()
    : { data: null };
  const paymentInstructions =
    (payRow as { payment_instructions: string | null } | null)?.payment_instructions ?? null;
  const isPrivate = Boolean((payRow as { is_private?: boolean } | null)?.is_private);
  const blockedUsers = userId ? await listBlockedUsers(userId).catch(() => []) : [];
  const weekStart = normalizeWeekStart((payRow as { week_start?: string } | null)?.week_start);

  return (
    <div className="w-full min-w-0 max-w-5xl">
      <HashToTab />
      <div className="mb-5 max-md:hidden">
        <h1 className="max-md:hidden text-2xl font-bold text-charcoal-100">설정</h1>
        <p className="mt-1 text-sm text-charcoal-500">계정 및 프로필 설정</p>
      </div>
      {tab ? (
        <Link href={`/${params.username}/settings`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-navy-500 md:hidden">
          ‹ 설정
        </Link>
      ) : (
        <SettingsPhoneList username={params.username} cardsOpen={cardsOpenFor(userId)} />
      )}

      {!profile.email_verified && (
        <div className="mb-5">
          <VerifyEmailBanner email={(profile.email as string | null) ?? null} />
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="max-md:hidden">
          <SectionNav items={SECTIONS} />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          {/* 프로필: 사진 + 소개·학력·경력·관심사·SNS 를 한자리에.
              예전엔 사진만 여기 있고 나머지는 "계정" 섹션에 있어서, 소개를
              고치려는 사람이 프로필을 눌러도 찾을 수 없었다. */}
          <section id="profile" className={`scroll-mt-16 space-y-6 ${ph("profile")}`}>
            <AvatarUploader
              initialUrl={(profile.avatar_url as string | null) ?? null}
              name={profile.display_name || profile.username}
            />
            <SettingsForm
              username={profile.username}
              displayName={profile.display_name || ""}
              birthDate={profile.birth_date || ""}
              bio={profile.bio || ""}
              socialLinks={profile.social_links || {}}
              education={profile.education || []}
              experience={profile.experience || []}
              interests={profile.interests || []}
              email={(profile.email as string | null) ?? null}
              emailVerified={!!profile.email_verified}
              createdAt={profile.created_at}
            />
          </section>

          <section id="google" className={`scroll-mt-16 ${ph("google")}`}>
            {googleError && (
              <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {googleError}
              </p>
            )}
            <GoogleAccountsSection
              primaryConnected={googleConnected}
              primaryEmail={null}
              extras={extras.map((a) => ({
                id: a.id,
                email: a.email,
                created_at:
                  (a as unknown as { created_at?: string }).created_at ??
                  new Date().toISOString(),
              }))}
            />
            {cardsOpenFor(userId) && (
              <a
                href={`/${params.username}/cards`}
                data-testid="cardsEntry"
                className="mt-3 flex items-center justify-between rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 px-5 py-3 text-sm text-charcoal-200 hover:bg-charcoal-800/40 max-md:min-h-11"
              >
                <span>명함 → 구글 연락처 <span className="text-xs text-charcoal-500">(시험)</span></span>
                <span aria-hidden className="text-charcoal-500">›</span>
              </a>
            )}
          </section>

          <section id="link-theme" className={`scroll-mt-16 ${ph("link-theme")}`}>
            <LinkThemePicker
              username={params.username}
              current={(profile?.link_theme as string | null) ?? null}
            />
          </section>

          <section id="calendars" className={`scroll-mt-16 space-y-6 ${ph("calendars")}`}>
            <WeekStartPicker initial={weekStart} />
            <MyCalendars initial={myCalendars} googleConnected={googleConnected} />
          </section>

          <section id="work-hours" className={`scroll-mt-16 ${ph("work-hours")}`}>
            <WorkHoursForm initial={workHours} />
          </section>

          <section id="payment" className={`scroll-mt-16 ${ph("payment")}`}>
            <PaymentInstructionsForm initial={paymentInstructions} />
          </section>

          <section id="locations" className={`scroll-mt-16 ${ph("locations")}`}>
            <LocationBuffersForm initial={locationBuffers} />
          </section>

          {/* iOS 설정 '사람 찾기'와 같은 기능 — 켜기·끄기는 오르빗 화면의 카드에 이미 있어 그리로 보낸다(11/21 묶음 다) */}
          <section id="people-import" className={`scroll-mt-16 ${ph("people-import")}`}>
            <Link
              href={`/${params.username}/people`}
              className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-5 py-4 hover:bg-charcoal-800/40"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-charcoal-200">캘린더에서 사람 찾기</span>
                <span className="mt-1 block text-xs text-charcoal-500">
                  캘린더 일정의 참석자 이름과 이메일만 읽어 자주 만난 사람을 오르빗에 제안해요. 상대에게는 아무것도 전송되지 않아요. 켜기·끄기는 오르빗에서 해요.
                </span>
              </span>
              <span aria-hidden className="text-charcoal-500">›</span>
            </Link>
          </section>

          <section id="referral" className={`scroll-mt-16 ${ph("referral")}`}>
            <ReferralLink username={profile.username} />
          </section>

          <section id="notifications" className={`scroll-mt-16 ${ph("notifications")}`}>
            <NotificationPrefs initial={notifPrefs} />
          </section>

          <section id="theme" className={`scroll-mt-16 ${ph("theme")}`}>
            <ThemeSection />
          </section>

          <section id="integrations" className={`scroll-mt-16 ${ph("integrations")}`}>
            <IntegrationTokens initial={patRows} />
          </section>

          <section id="account" className={`scroll-mt-16 ${ph("account")}`}>
            <PasswordForm username={profile.username} />
          </section>

          <section id="privacy" className={`scroll-mt-16 ${ph("privacy")}`}>
            <PrivacySection initialPrivate={isPrivate} initialBlocked={blockedUsers} />
          </section>

          <section id="danger" className={`scroll-mt-16 ${ph("danger")}`}>
            <DeleteAccountSection username={profile.username} />
          </section>
        </div>
      </div>
    </div>
  );
}
