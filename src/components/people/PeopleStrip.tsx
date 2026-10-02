import Image from "next/image";
import Link from "next/link";
import { daysSinceLabel, type OrbitResponse } from "@/lib/people-types";
import { PersonAvatar } from "./PersonAvatar";

/**
 * 캘린더 위의 "나의 오르빗" 한 줄 — 가장 가까운 사람들과 마지막 만남.
 * 캘린더가 주인공이라 한 줄과, 안부 넛지도 한 줄로만 둔다 (자세한 카드는 오르빗 화면에).
 */
export function PeopleStrip({
  username,
  me,
  orbit,
}: {
  username: string;
  me: { name: string; avatarUrl: string | null };
  orbit: OrbitResponse;
}) {
  const top = orbit.people.slice(0, 7);
  if (top.length === 0) return null;
  const nudge = orbit.nudges[0];
  const nudgePerson = nudge && orbit.people.find((p) => p.id === nudge.personId);

  return (
    <div className="shrink-0">
      <section className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-charcoal-100">나의 오르빗</p>
          <Link href={`/${username}/people`} className="text-xs font-medium text-navy-400 hover:text-navy-300">
            관계 보기
          </Link>
        </div>
        <div className="-mx-1 mt-2 flex gap-3 overflow-x-auto px-1 pb-1">
          <Link href={`/${username}/people`} className="flex w-12 shrink-0 flex-col items-center gap-1">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-navy-500 to-navy-400 text-sm font-bold text-white ring-2 ring-navy-400/40 ring-offset-2 ring-offset-[rgb(var(--bg-surface))]">
              {me.avatarUrl ? (
                <Image src={me.avatarUrl} alt={me.name} fill sizes="40px" className="object-cover" unoptimized />
              ) : (
                "나"
              )}
            </span>
            <span className="text-2xs font-semibold text-charcoal-200">나</span>
          </Link>
          {top.map((p) => (
            <Link
              key={p.id}
              href={`/${username}/people/${p.id}`}
              className="flex w-12 shrink-0 flex-col items-center gap-1"
            >
              <PersonAvatar person={p} size={40} />
              <span className="w-full truncate text-center text-2xs font-semibold text-charcoal-200">{p.name}</span>
              <span className="-mt-1 text-3xs text-charcoal-500">{daysSinceLabel(p.daysSince)}</span>
            </Link>
          ))}
        </div>
        {nudgePerson && (
          <Link
            href={`/${username}/people/${nudgePerson.id}`}
            className="mt-2 flex items-center gap-2 border-t border-charcoal-800/50 pt-2 text-xs text-charcoal-400 hover:text-charcoal-200"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: nudgePerson.color }} />
            <span className="min-w-0 flex-1 truncate">
              {nudgePerson.name}님과 만난 지 {nudge.days}일 — 안부 한 줄 어때요?
            </span>
            <span className="shrink-0 font-medium text-navy-400">보기</span>
          </Link>
        )}
      </section>
    </div>
  );
}
