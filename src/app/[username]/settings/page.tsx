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
  const [googleConnected, myCalendars, extras] = await Promise.all([
    isGoogleCalendarConnected().catch(() => false),
    listMyCalendars().catch(() => []),
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
        experience={profile.experience || []}
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

      <MyCalendars initial={myCalendars} googleConnected={googleConnected} />
    </div>
  );
}
