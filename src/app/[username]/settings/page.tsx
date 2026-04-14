import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { CalendarVisibilityForm } from "./CalendarVisibilityForm";
import { getGoogleCalendars, isGoogleCalendarConnected } from "../calendar/actions";
import { getCalendarSettings } from "@/lib/calendar-settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const [googleConnected, calendars, calendarSettings] = await Promise.all([
    isGoogleCalendarConnected().catch(() => false),
    getGoogleCalendars().catch(() => []),
    getCalendarSettings().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Settings</h1>
        <p className="mt-1 text-sm text-charcoal-500">계정 및 프로필 설정</p>
      </div>

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
