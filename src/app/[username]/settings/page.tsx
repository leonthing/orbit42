import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { CalendarVisibilityForm } from "./CalendarVisibilityForm";
import { AvatarUploader } from "./AvatarUploader";
import { getGoogleCalendars, isGoogleCalendarConnected } from "../calendar/actions";
import { getCalendarSettings } from "@/lib/calendar-settings";
import { listExtraGoogleAccounts } from "@/lib/google";
import { getUserId } from "@/lib/db";
import { GoogleAccountsSection } from "./GoogleAccountsSection";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const userId = await getUserId();
  const [googleConnected, calendars, calendarSettings, extras] = await Promise.all([
    isGoogleCalendarConnected().catch(() => false),
    getGoogleCalendars().catch(() => []),
    getCalendarSettings().catch(() => []),
    userId ? listExtraGoogleAccounts(userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Settings</h1>
        <p className="mt-1 text-sm text-charcoal-500">계정 및 프로필 설정</p>
      </div>

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
        interests={profile.interests || []}
        createdAt={profile.created_at}
      />

      <GoogleAccountsSection
        primaryConnected={googleConnected}
        primaryEmail={null}
        extras={extras.map((a) => ({
          id: a.id,
          email: a.email,
          created_at: (a as unknown as { created_at?: string }).created_at ?? new Date().toISOString(),
        }))}
      />

      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">
            Calendar visibility
          </h2>
          <p className="mt-1 text-xs text-charcoal-500">
            각 캘린더의 공개 범위를 정하세요. 기본값은 비공개입니다.
          </p>
        </div>
        <div className="p-5">
          {googleConnected ? (
            <CalendarVisibilityForm
              calendars={calendars}
              initialSettings={calendarSettings}
            />
          ) : (
            <p className="text-sm text-charcoal-500">
              Calendar 페이지에서 먼저 Google Calendar를 연결해주세요.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
