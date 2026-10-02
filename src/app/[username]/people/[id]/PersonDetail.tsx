"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import {
  SOURCE_LABELS,
  daysSinceLabel,
  type MeetingSource,
  type PersonDetailResponse,
  type PersonMeeting,
} from "@/lib/people-types";
import {
  deleteMeetingAction,
  logMeetingAction,
  updatePersonAction,
} from "../actions";

const TZ = "Asia/Seoul";

const MEETING_SOURCE: Record<MeetingSource, string> = {
  manual: "직접 기록",
  booking: "예약",
  participant: "일정 초대",
  google: "구글 캘린더",
  device: "기기 캘린더",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtHours(h: number) {
  if (h <= 0) return "–";
  return h < 10 ? `${Math.round(h * 10) / 10}시간` : `${Math.round(h)}시간`;
}

/** datetime-local 입력값(서울 기준) — 지금 */
function nowLocalInput() {
  const d = new Date(Date.now() + 9 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

export function PersonDetail({
  username,
  detail,
}: {
  username: string;
  detail: PersonDetailResponse;
}) {
  const { person: p, past, upcoming } = detail;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [logging, setLogging] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error ?? "처리하지 못했어요.");
      if (ok) toast.success(ok);
      after?.();
      router.refresh();
    });

  const subtitle = [p.company, p.role].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-16">
      <Link href={`/${username}/people`} className="inline-flex items-center gap-1 text-sm text-charcoal-400 hover:text-charcoal-200">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        오르빗
      </Link>

      <header className="flex flex-col items-center text-center">
        <PersonAvatar
          person={p}
          size={96}
          className={p.status === "archived" ? "opacity-60" : ""}
        />
        <h1 className="mt-3 text-2xl font-bold text-charcoal-50">{p.name}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-charcoal-400">{subtitle}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-2xs">
          {p.member && (
            <Link href={`/${p.member.username}`} className="rounded-full bg-navy-500/10 px-2 py-0.5 font-semibold text-navy-400 hover:bg-navy-500/20">
              @{p.member.username}
            </Link>
          )}
          {p.email && <span className="rounded-full bg-charcoal-800/50 px-2 py-0.5 text-charcoal-400">{p.email}</span>}
          <span className="rounded-full bg-charcoal-800/50 px-2 py-0.5 text-charcoal-500">{SOURCE_LABELS[p.source]}</span>
          {p.status === "archived" && (
            <span className="rounded-full bg-charcoal-800/50 px-2 py-0.5 text-charcoal-500">보관함</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="마지막 만남" value={daysSinceLabel(p.daysSince)} color={p.color} />
        <StatTile label="함께한 시간" value={fmtHours(p.hoursTogether)} color={p.color} />
        <StatTile label="만남" value={`${p.meetingsTotal}번`} color={p.color} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ActionTile label="만났어요" onClick={() => setLogging((v) => !v)} color={p.color} icon="check" />
        <ActionTile label="일정 잡기" href={`/${username}/calendar`} color={p.color} icon="calendar" />
        {p.member ? (
          <ActionTile label="시간 요청" href={`/${p.member.username}`} color={p.color} icon="clock" />
        ) : p.email ? (
          <ActionTile label="메일" href={`mailto:${p.email}`} color={p.color} icon="mail" />
        ) : (
          <ActionTile label="정보 수정" href="#info" color={p.color} icon="pencil" />
        )}
      </div>

      {logging && (
        <form
          className="space-y-2 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const at = String(f.get("at") ?? "");
            act(
              () =>
                logMeetingAction(p.id, {
                  title: String(f.get("title") ?? ""),
                  // 입력값은 서울 시각이다.
                  at: at ? new Date(`${at}:00+09:00`).toISOString() : undefined,
                  minutes: Number(f.get("minutes") ?? 60),
                }),
              "만남을 남겼어요",
              () => setLogging(false),
            );
          }}
        >
          <input name="title" placeholder="무엇을 했나요? (예: 커피챗)" className={FIELD} autoFocus />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input name="at" type="datetime-local" defaultValue={nowLocalInput()} className={FIELD} />
            <select name="minutes" defaultValue="60" className={FIELD}>
              <option value="30">30분</option>
              <option value="60">1시간</option>
              <option value="90">1시간 30분</option>
              <option value="120">2시간</option>
              <option value="180">3시간</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClasses({ variant: "ghost", size: "sm" })} onClick={() => setLogging(false)}>
              취소
            </button>
            <button type="submit" disabled={pending} className={buttonClasses({ size: "sm" })}>
              기록
            </button>
          </div>
        </form>
      )}

      {upcoming.length > 0 && (
        <MeetingSection title="다가오는 만남" meetings={upcoming} color={p.color} />
      )}
      <MeetingSection
        title="함께한 시간"
        meetings={past}
        color={p.color}
        empty="아직 기록된 만남이 없어요. 만나면 ‘만났어요’로 남겨보세요."
        onDelete={(m) => act(() => deleteMeetingAction(m.id), "기록을 지웠어요")}
        pending={pending}
      />

      <InfoForm detail={detail} />

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {p.status === "archived" ? (
          <button
            type="button"
            disabled={pending}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            onClick={() => act(() => updatePersonAction(p.id, { status: "active" }), "궤도로 되돌렸어요")}
          >
            궤도로 되돌리기
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            onClick={() => act(() => updatePersonAction(p.id, { status: "archived" }), "보관했어요")}
          >
            보관하기
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
          onClick={() => {
            if (!confirm(`${p.name}님을 오르빗에서 뺄까요? 캘린더에서 다시 제안하지 않아요.`)) return;
            act(
              () => updatePersonAction(p.id, { status: "dismissed" }),
              "오르빗에서 뺐어요",
              () => router.push(`/${username}/people`),
            );
          }}
        >
          오르빗에서 빼기
        </button>
      </div>
    </div>
  );
}

const FIELD =
  "h-10 w-full rounded-lg border border-charcoal-800/70 bg-[rgb(var(--bg-base))] px-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none";

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-3">
      <p className="text-2xs font-medium" style={{ color }}>{label}</p>
      <p className="mt-1 text-lg font-bold text-charcoal-50">{value}</p>
    </div>
  );
}

const ICONS: Record<string, string> = {
  check: "M4.5 12.75l6 6 9-13.5",
  calendar:
    "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  mail: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
  pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z",
};

function ActionTile({
  label,
  icon,
  color,
  href,
  onClick,
}: {
  label: string;
  icon: string;
  color: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon]} />
      </svg>
      <span className="text-xs font-semibold text-charcoal-200">{label}</span>
    </>
  );
  const cls =
    "flex flex-col items-center gap-1.5 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] py-3.5 transition hover:border-charcoal-700 active:scale-[0.98]";
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

function MeetingSection({
  title,
  meetings,
  color,
  empty,
  onDelete,
  pending,
}: {
  title: string;
  meetings: PersonMeeting[];
  color: string;
  empty?: string;
  onDelete?: (m: PersonMeeting) => void;
  pending?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4">
      <p className="text-sm font-bold text-charcoal-100">{title}</p>
      {meetings.length === 0 ? (
        <p className="mt-2 text-xs text-charcoal-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-charcoal-800/50">
          {meetings.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-charcoal-100">{m.title || "만남"}</p>
                <p className="text-2xs text-charcoal-500">
                  {fmtDateTime(m.startAt)} · {MEETING_SOURCE[m.source]}
                </p>
              </div>
              {onDelete && m.source === "manual" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(m)}
                  className="text-2xs text-charcoal-500 hover:text-charcoal-200"
                >
                  지우기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InfoForm({ detail }: { detail: PersonDetailResponse }) {
  const p = detail.person;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <form
      id="info"
      className="space-y-2 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await updatePersonAction(p.id, {
            ...(p.member ? {} : { name: String(f.get("name") ?? "") }),
            company: String(f.get("company") ?? ""),
            role: String(f.get("role") ?? ""),
            memo: String(f.get("memo") ?? ""),
          });
          if (r.ok) {
            toast.success("저장했어요");
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <p className="text-sm font-bold text-charcoal-100">정보와 메모</p>
      <p className="text-2xs text-charcoal-500">나만 볼 수 있어요</p>
      {!p.member && <input name="name" defaultValue={p.name} placeholder="이름" className={FIELD} />}
      <div className="grid grid-cols-2 gap-2">
        <input name="company" defaultValue={p.company ?? ""} placeholder="회사" className={FIELD} />
        <input name="role" defaultValue={p.role ?? ""} placeholder="직함" className={FIELD} />
      </div>
      <textarea
        name="memo"
        defaultValue={p.memo ?? ""}
        rows={4}
        placeholder="이 사람에 대해 기억해 둘 것 — 관심사, 지난번 나눈 이야기, 다음에 물어볼 것"
        className={`${FIELD} h-auto py-2`}
      />
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonClasses({ size: "sm" })}>
          저장
        </button>
      </div>
    </form>
  );
}
