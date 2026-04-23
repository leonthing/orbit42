import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { AvatarUploader } from "./AvatarUploader";
import { isGoogleCalendarConnected } from "../calendar/actions";
import { listMyCalendars } from "@/lib/calendars";
import { listExtraGoogleAccounts } from "@/lib/google";
import { getUserId } from "@/lib/db";
import { GoogleAccountsSection } from "./GoogleAccountsSection";
import { MyCalendars } from "./MyCalendars";
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

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "profile", label: "프로필" },
  { id: "google", label: "Google" },
  { id: "calendars", label: "캘린더" },
  { id: "work-hours", label: "근무시간" },
  { id: "locations", label: "장소" },
  { id: "referral", label: "추천" },
  { id: "notifications", label: "알림" },
  { id: "account", label: "계정" },
  { id: "danger", label: "계정 삭제" },
];

export default async function SettingsPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const userId = await getUserId();
  const [googleConnected, myCalendars, extras, notifPrefs, workHours, locationBuffers] =
    await Promise.all([
      isGoogleCalendarConnected().catch(() => false),
      listMyCalendars().catch(() => []),
      userId ? listExtraGoogleAccounts(userId) : Promise.resolve([]),
      getMyPrefs().catch(() => ({})),
      userId ? getWorkHours(userId) : Promise.resolve({}),
      listLocationBuffers(userId ?? undefined).catch(() => []),
    ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-charcoal-100">설정</h1>
        <p className="mt-1 text-sm text-charcoal-500">계정 및 프로필 설정</p>
      </div>

      {!profile.email_verified && (
        <div className="mb-5">
          <VerifyEmailBanner email={(profile.email as string | null) ?? null} />
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <SectionNav items={SECTIONS} />

        <div className="min-w-0 flex-1 space-y-6">
          <section id="profile" className="scroll-mt-16">
            <AvatarUploader
              initialUrl={(profile.avatar_url as string | null) ?? null}
              name={profile.display_name || profile.username}
            />
          </section>

          <section id="google" className="scroll-mt-16">
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
          </section>

          <section id="calendars" className="scroll-mt-16">
            <MyCalendars initial={myCalendars} googleConnected={googleConnected} />
          </section>

          <section id="work-hours" className="scroll-mt-16">
            <WorkHoursForm initial={workHours} />
          </section>

          <section id="locations" className="scroll-mt-16">
            <LocationBuffersForm initial={locationBuffers} />
          </section>

          <section id="referral" className="scroll-mt-16">
            <ReferralLink username={profile.username} />
          </section>

          <section id="notifications" className="scroll-mt-16">
            <NotificationPrefs initial={notifPrefs} />
          </section>

          <section id="account" className="scroll-mt-16">
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

          <section id="danger" className="scroll-mt-16">
            <DeleteAccountSection username={profile.username} />
          </section>
        </div>
      </div>
    </div>
  );
}
