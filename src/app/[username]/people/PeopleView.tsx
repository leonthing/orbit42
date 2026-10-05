"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { OrbitCanvas } from "@/components/people/OrbitCanvas";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { NudgeCard } from "@/components/people/NudgeCard";
import {
  daysSinceLabel,
  type OrbitPerson,
  type OrbitResponse,
} from "@/lib/people-types";
import {
  addPersonAction,
  logMeetingAction,
  resolveSuggestionsAction,
  setPeopleImportAction,
  syncPeopleAction,
} from "./actions";

const TZ = "Asia/Seoul";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: TZ, month: "short", day: "numeric" });
}

function fmtHours(h: number) {
  if (h <= 0) return "–";
  return h < 10 ? `${Math.round(h * 10) / 10}시간` : `${Math.round(h)}시간`;
}

export function PeopleView({
  username,
  me,
  orbit,
}: {
  username: string;
  me: { name: string; avatarUrl: string | null };
  orbit: OrbitResponse;
}) {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(true);
  const [adding, setAdding] = useState(false);
  const synced = useRef(false);
  const hrefFor = (p: OrbitPerson) => `/${username}/people/${p.id}`;

  // 화면을 연 뒤 새 팔로우·예약·캘린더 일정을 반영한다. 서버가 구글 재조회는
  // 6시간 간격으로 거르므로 매번 불러도 된다.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    syncPeopleAction().then(() => {
      setSyncing(false);
      router.refresh();
    });
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-16">
      <header className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="max-md:hidden text-2xl font-bold tracking-tight text-charcoal-50">오르빗</h1>
          <p className="mt-1 text-sm text-charcoal-400">나를 중심으로, 시간을 함께 쓰는 사람들</p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && <span className="whitespace-nowrap text-2xs text-charcoal-500">업데이트 중…</span>}
          <Link href="/explore" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            사람 찾기
          </Link>
        </div>
      </header>

      <OrbitCanvas
        people={orbit.people}
        me={me}
        hrefFor={hrefFor}
        addSlot={
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="사람 추가"
            className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-charcoal-700 bg-[rgb(var(--bg-surface))] text-charcoal-400 transition hover:border-navy-400 hover:text-navy-400"
          >
            <PlusIcon />
          </button>
        }
      />

      {adding && (
        <AddPersonForm
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            toast.success("궤도에 추가했어요");
            router.push(`/${username}/people/${id}`);
          }}
        />
      )}

      {orbit.nudges.length > 0 && (
        <NudgeList orbit={orbit} username={username} />
      )}

      {!orbit.importEnabled ? (
        <ImportOptIn googleConnected={orbit.googleConnected} />
      ) : (
        orbit.suggestions.length > 0 && <Suggestions people={orbit.suggestions} />
      )}

      {orbit.people.map((p) => (
        <PersonCard key={p.id} person={p} href={hrefFor(p)} />
      ))}

      {orbit.people.length === 0 && (
        <p className="rounded-2xl border border-dashed border-charcoal-800/60 px-6 py-8 text-center text-sm text-charcoal-400">
          팔로우하거나 예약으로 만난 사람이 여기 모여요.
          <br />
          캘린더에서 찾기를 켜면 미팅에서 만난 사람도 제안해 드려요.
        </p>
      )}

      {orbit.archived.length > 0 && <Archived people={orbit.archived} hrefFor={hrefFor} />}

      {orbit.importEnabled && <ImportFooter syncedAt={orbit.syncedAt} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function PersonCard({ person: p, href }: { person: OrbitPerson; href: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const subtitle =
    [p.company, p.role].filter(Boolean).join(" · ") ||
    (p.member ? `@${p.member.username}` : p.email ?? "");

  return (
    <div className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4 transition hover:border-charcoal-700">
      <div className="flex items-center gap-3">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          <PersonAvatar person={p} size={46} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-charcoal-50">{p.name}</p>
            {subtitle && <p className="truncate text-xs text-charcoal-500">{subtitle}</p>}
          </div>
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await logMeetingAction(p.id, {});
              if (r.ok) {
                toast.success(`${p.name}님과의 만남을 남겼어요`);
                router.refresh();
              } else toast.error(r.error);
            })
          }
          className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
          style={{ color: p.color, background: `${p.color}1f` }}
          title="오늘 만났어요"
        >
          <PlusIcon small /> 만났어요
        </button>
      </div>

      <Link href={href} className="mt-3 grid grid-cols-4 divide-x divide-charcoal-800/60 text-center">
        <Metric label="마지막 만남" value={daysSinceLabel(p.daysSince)} />
        <Metric label="함께한 시간" value={fmtHours(p.hoursTogether)} />
        <Metric label="최근 90일" value={`${p.meetings90}번`} />
        <Metric label="다음 일정" value={p.nextMeetingAt ? shortDate(p.nextMeetingAt) : "–"} />
      </Link>

      {(p.lastMeetingTitle || p.nextMeetingTitle) && (
        <div className="mt-3 space-y-1 border-t border-charcoal-800/50 pt-3 text-xs text-charcoal-400">
          {p.nextMeetingTitle && (
            <p className="truncate">
              <span className="mr-1.5 font-semibold" style={{ color: p.color }}>다음</span>
              {p.nextMeetingTitle}
            </p>
          )}
          {p.lastMeetingTitle && (
            <p className="truncate">
              <span className="mr-1.5 font-semibold text-charcoal-500">최근</span>
              {p.lastMeetingTitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <p className="truncate text-sm font-semibold text-charcoal-100">{value}</p>
      <p className="text-2xs text-charcoal-500">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function NudgeList({ orbit, username }: { orbit: OrbitResponse; username: string }) {
  const byId = new Map(orbit.people.map((p) => [p.id, p]));
  return (
    <div className="space-y-2">
      {orbit.nudges.map((n) => {
        const p = byId.get(n.personId);
        return p ? <NudgeCard key={n.personId} person={p} days={n.days} username={username} /> : null;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function ImportOptIn({ googleConnected }: { googleConnected: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-navy-400/30 bg-navy-500/5 p-5">
      <p className="text-base font-bold text-charcoal-50">캘린더에서 만난 사람 찾기</p>
      <p className="mt-1.5 text-sm leading-relaxed text-charcoal-400">
        최근 6개월 미팅의 참석자 이름과 이메일로 관계 지도를 만들어요. 찾은 사람은 바로 넣지 않고
        제안으로 보여드려요. 상대에게는 아무것도 전송되지 않고, 언제든 끌 수 있어요.
      </p>
      {googleConnected ? (
        <button
          type="button"
          disabled={pending}
          className={`${buttonClasses({ size: "md" })} mt-4`}
          onClick={() =>
            start(async () => {
              const r = await setPeopleImportAction(true);
              if (r.ok) {
                toast.success("캘린더에서 사람을 찾았어요");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending ? "캘린더 읽는 중…" : "구글 캘린더에서 찾기"}
        </button>
      ) : (
        <Link href="settings#google" className={`${buttonClasses({ size: "md" })} mt-4`}>
          구글 캘린더 연결하기
        </Link>
      )}
      <p className="mt-3 text-2xs text-charcoal-500">
        iPhone 앱에서는 iCloud·Outlook 등 기기 캘린더에서도 찾을 수 있어요.
      </p>
    </div>
  );
}

function Suggestions({ people }: { people: OrbitPerson[] }) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const visible = people.filter((p) => !done.has(p.id));
  if (visible.length === 0) return null;

  const resolve = (ids: string[], action: "accept" | "dismiss") =>
    start(async () => {
      const r = await resolveSuggestionsAction(ids, action);
      if (!r.ok) return toast.error(r.error);
      setDone((prev) => new Set([...Array.from(prev), ...ids]));
      if (action === "accept") toast.success(ids.length > 1 ? `${ids.length}명을 궤도에 넣었어요` : "궤도에 넣었어요");
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-charcoal-50">캘린더에서 찾은 사람 {visible.length}명</p>
          <p className="text-xs text-charcoal-500">궤도에 넣을 사람만 골라주세요</p>
        </div>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
          onClick={() => resolve(visible.map((p) => p.id), "accept")}
        >
          모두 추가
        </button>
      </div>
      <ul className="mt-3 divide-y divide-charcoal-800/50">
        {visible.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <PersonAvatar person={p} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-charcoal-100">
                {p.name}
                {p.member && <span className="ml-1.5 text-2xs font-medium text-navy-400">orbit42</span>}
              </p>
              <p className="truncate text-xs text-charcoal-500">
                {p.meetingsTotal > 0 ? `${p.meetingsTotal}번 만남 · ${daysSinceLabel(p.daysSince)}` : "예정된 미팅"}
                {(p.lastMeetingTitle || p.nextMeetingTitle) && ` · ${p.lastMeetingTitle ?? p.nextMeetingTitle}`}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve([p.id], "dismiss")}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              괜찮아요
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve([p.id], "accept")}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              추가
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportFooter({ syncedAt }: { syncedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-2xs text-charcoal-500">
      <span>
        캘린더에서 사람 찾기 켜짐
        {syncedAt &&
          ` · ${new Date(syncedAt).toLocaleString("ko-KR", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} 확인`}
      </span>
      <span className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          className="underline-offset-2 hover:text-charcoal-300 hover:underline"
          onClick={() =>
            start(async () => {
              await syncPeopleAction(true);
              router.refresh();
            })
          }
        >
          {pending ? "확인 중…" : "지금 다시 찾기"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="underline-offset-2 hover:text-charcoal-300 hover:underline"
          onClick={() => {
            if (!confirm("캘린더에서 가져온 만남과 고르지 않은 제안이 지워져요. 끌까요?")) return;
            start(async () => {
              const r = await setPeopleImportAction(false);
              if (r.ok) {
                toast.success("캘린더에서 사람 찾기를 껐어요");
                router.refresh();
              } else toast.error(r.error);
            });
          }}
        >
          끄기
        </button>
      </span>
    </div>
  );
}

function Archived({ people, hrefFor }: { people: OrbitPerson[]; hrefFor: (p: OrbitPerson) => string }) {
  return (
    <section className="pt-4">
      <p className="text-sm font-bold text-charcoal-200">보관한 사람</p>
      <p className="text-xs text-charcoal-500">궤도에서는 빠졌지만 만남 기록은 그대로 있어요</p>
      <ul className="mt-2 divide-y divide-charcoal-800/50 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] px-3">
        {people.map((p) => (
          <li key={p.id}>
            <Link href={hrefFor(p)} className="flex items-center gap-3 py-2.5">
              <PersonAvatar person={p} size={32} className="opacity-60" />
              <span className="flex-1 truncate text-sm text-charcoal-200">{p.name}</span>
              <span className="text-2xs text-charcoal-500">
                {p.archivedAt ? `${shortDate(p.archivedAt)} 보관` : "보관함"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddPersonForm({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const field =
    "h-10 w-full rounded-lg border border-charcoal-800/70 bg-[rgb(var(--bg-base))] px-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none";
  return (
    <form
      className="space-y-3 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await addPersonAction({
            name: String(f.get("name") ?? ""),
            email: String(f.get("email") ?? ""),
            company: String(f.get("company") ?? ""),
            role: String(f.get("role") ?? ""),
          });
          if (r.ok) onAdded(r.id);
          else toast.error(r.error);
        });
      }}
    >
      <p className="text-base font-bold text-charcoal-50">사람 추가</p>
      <input name="name" required autoFocus placeholder="이름" className={field} />
      <input name="email" type="email" placeholder="이메일 (선택 — 캘린더 미팅과 이어져요)" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input name="company" placeholder="회사 (선택)" className={field} />
        <input name="role" placeholder="직함 (선택)" className={field} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost", size: "md" })}>
          취소
        </button>
        <button type="submit" disabled={pending} className={buttonClasses({ size: "md" })}>
          추가
        </button>
      </div>
    </form>
  );
}

function PlusIcon({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? "h-3.5 w-3.5" : "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
