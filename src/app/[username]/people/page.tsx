import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import { getUserId } from "@/lib/db";
import { getOrbit } from "@/lib/people";
import { PeopleView } from "./PeopleView";

export const metadata: Metadata = { title: "오르빗" };
export const dynamic = "force-dynamic";

// 관계 궤도는 나만 보는 화면이다. 남의 /people 은 그 사람 프로필로 보낸다.
export default async function PeoplePage({ params }: { params: { username: string } }) {
  const session = await getSession();
  if (session?.username !== params.username) redirect(`/${params.username}`);
  const [profile, userId] = await Promise.all([getProfile(params.username), getUserId()]);
  if (!profile || !userId) notFound();

  const orbit = await getOrbit(userId);
  return (
    <PeopleView
      username={params.username}
      me={{ name: profile.display_name || profile.username, avatarUrl: profile.avatar_url ?? null }}
      orbit={orbit}
    />
  );
}
