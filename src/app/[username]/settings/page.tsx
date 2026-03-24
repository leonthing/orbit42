import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

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
        socialLinks={profile.social_links || {}}
        createdAt={profile.created_at}
      />
    </div>
  );
}
