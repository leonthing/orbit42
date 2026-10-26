import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import { withoutDemo } from "@/lib/demo-visibility";
import { listFollowing } from "@/lib/follows";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  return {
    title: profile
      ? `${profile.display_name || profile.username} · 팔로잉`
      : "팔로잉",
  };
}

export default async function FollowingPage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const [rows, session] = await Promise.all([listFollowing(params.username), getSession()]);
  // 데모 계정은 내부 계정에게만 보인다 (개선-33) — 위 숫자도 이 목록 기준
  const people = withoutDemo(rows, (p) => p.username, session?.username);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${params.username}`}
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          ← {profile.display_name || profile.username}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-charcoal-100">팔로잉</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          팔로우하는 사람들 · {people.length}명
        </p>
      </header>

      {people.length === 0 ? (
        <EmptyState title="아직 팔로우하는 사람이 없어요" />
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
