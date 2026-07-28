import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import { listFollowers } from "@/lib/follows";
import { Avatar } from "@/components/Avatar";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  return {
    title: profile
      ? `${profile.display_name || profile.username} · Orbiters`
      : "Orbiters",
  };
}

export default async function FollowersPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const [followers, session] = await Promise.all([
    listFollowers(params.username),
    getSession(),
  ]);
  const isOwner = session?.username === params.username;

  return (
    <PeopleList
      username={params.username}
      displayName={profile.display_name || profile.username}
      title="Orbiters"
      hint="내 궤도를 따르는 사람들"
      people={followers}
      emptyBody={
        isOwner
          ? "아직 팔로워가 없어요. 프로필 링크를 공유해 사람들을 초대해보세요."
          : "아직 이 사람을 팔로우하는 사람이 없어요."
      }
      emptyExtra={
        isOwner ? (
          <div className="mt-4 flex justify-center">
            <CopyLinkButton url={`${SITE.url}/${params.username}`} />
          </div>
        ) : null
      }
    />
  );
}

function PeopleList({
  username,
  displayName,
  title,
  hint,
  people,
  emptyBody,
  emptyExtra,
}: {
  username: string;
  displayName: string;
  title: string;
  hint: string;
  people: { id: string; username: string; display_name: string | null; avatar_url?: string | null }[];
  emptyBody: string;
  emptyExtra?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${username}`}
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          ← {displayName}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-charcoal-100">{title}</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          {hint} · {people.length}명
        </p>
      </header>

      {people.length === 0 ? (
        <div className="rounded-xl border border-dashed border-charcoal-800/60 p-8 text-center text-sm text-charcoal-500">
          {emptyBody}
          {emptyExtra}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${p.username}`}
                className="flex items-center gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 hover:border-navy-400/60"
              >
                <Avatar url={p.avatar_url ?? null} name={p.display_name || p.username} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-charcoal-100">
                    {p.display_name || p.username}
                  </p>
                  <p className="text-xs text-charcoal-500">@{p.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
