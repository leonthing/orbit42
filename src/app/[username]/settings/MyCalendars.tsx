"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarGoalShare } from "./CalendarGoalShare";
import {
  createNativeCalendar,
  updateCalendar,
  deleteCalendar,
  type Calendar,
} from "@/lib/calendars";
import {
  PURPOSE_OPTIONS,
  CALENDAR_COLORS,
  type CalendarPurpose,
  type CalendarVisibility,
} from "@/lib/calendars-types";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

const VISIBILITY: { value: CalendarVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "followers", label: "Followers" },
  { value: "public", label: "Public" },
];

export function MyCalendars({
  initial,
  googleConnected,
}: {
  initial: Calendar[];
  googleConnected: boolean;
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-200">내 캘린더</h2>
          <p className="mt-1 text-xs text-charcoal-500">
            orbit42 안에서 바로 캘린더를 만들거나, Google 캘린더도 함께 관리할 수
            있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="shrink-0 whitespace-nowrap rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400"
        >
          {showNew ? "닫기" : "+ 새 캘린더"}
        </button>
      </div>

      {showNew && (
        <div className="border-b border-charcoal-800/40 px-5 py-4">
          <NewCalendarForm
            googleConnected={googleConnected}
            onDone={() => {
              setShowNew(false);
              router.refresh();
            }}
          />
        </div>
      )}

      <ul className="divide-y divide-charcoal-800/40">
        {initial.map((c) => (
          <CalendarRow key={c.id} calendar={c} />
        ))}
        {initial.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-charcoal-500">
            캘린더가 없어요. 위에서 새로 만들어보세요.
          </li>
        )}
      </ul>
    </section>
  );
}

function CalendarRow({ calendar }: { calendar: Calendar }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState(calendar.color);

  const changeVisibility = (next: CalendarVisibility) =>
    startTransition(async () => {
      await updateCalendar(calendar.id, { visibility: next });
      router.refresh();
    });

  const changePurpose = (next: CalendarPurpose | null) =>
    startTransition(async () => {
      await updateCalendar(calendar.id, { purpose: next });
      router.refresh();
    });

  const changeColor = (c: string) => {
    setColor(c);
    startTransition(async () => {
      await updateCalendar(calendar.id, { color: c });
      router.refresh();
    });
  };

  const onDelete = async () => {
    if (calendar.is_default) {
      toast.error("기본 캘린더는 삭제할 수 없어요.");
      return;
    }
    const ok = await confirm({
      title:
        calendar.source === "google"
          ? "연결을 해제할까요?"
          : "이 캘린더를 삭제할까요?",
      body:
        calendar.source === "google"
          ? "Google 에서는 유지되고, orbit42 화면에서만 사라져요."
          : `"${calendar.name}" 과 안에 저장된 일정이 모두 사라져요.`,
      confirmLabel: calendar.source === "google" ? "연결 해제" : "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteCalendar(calendar.id);
      router.refresh();
    });
  };

  const purposeMeta = PURPOSE_OPTIONS.find((p) => p.value === calendar.purpose);

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-charcoal-100">
              <span className="truncate">{calendar.name}</span>
              {calendar.is_default && (
                <span className="rounded-full bg-navy-400/15 px-2 py-0.5 text-2xs font-semibold text-navy-600 ring-1 ring-navy-400/30 dark:text-navy-200 dark:ring-0">
                  기본
                </span>
              )}
              {calendar.source === "google" && (
                <span className="rounded-full bg-charcoal-800/60 px-2 py-0.5 text-2xs text-charcoal-700 dark:text-charcoal-300">
                  Google
                </span>
              )}
            </p>
            {purposeMeta && (
              <p className="text-xs text-charcoal-500">{purposeMeta.label}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg bg-charcoal-900/60 p-1 sm:overflow-visible">
          {VISIBILITY.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => changeVisibility(v.value)}
              disabled={pending}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                calendar.visibility === v.value
                  ? "bg-navy-500 text-white"
                  : "text-charcoal-500 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-2xs uppercase tracking-wider text-charcoal-500">
          용도
        </span>
        <button
          type="button"
          onClick={() => changePurpose(null)}
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs ${
            calendar.purpose === null
              ? "bg-charcoal-700 text-white"
              : "text-charcoal-600 hover:text-charcoal-900 dark:text-charcoal-500 dark:hover:text-charcoal-300"
          }`}
        >
          없음
        </button>
        {PURPOSE_OPTIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => changePurpose(p.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs transition-colors ${
              calendar.purpose === p.value
                ? "bg-navy-500 text-white"
                : "bg-charcoal-900/50 text-charcoal-700 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs uppercase tracking-wider text-charcoal-500">색상</span>
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => changeColor(c)}
            className={`h-5 w-5 rounded-full ${
              color === c ? "ring-2 ring-navy-400 ring-offset-1 ring-offset-charcoal-900" : ""
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg border border-charcoal-800 px-2.5 py-1 text-2xs text-charcoal-400 hover:border-red-500/50 hover:text-red-400"
        >
          {calendar.source === "google" ? "연결 해제" : "삭제"}
        </button>
      </div>

      <CalendarGoalShare calendar={calendar} />
    </li>
  );
}

function NewCalendarForm({
  onDone,
}: {
  googleConnected: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<CalendarPurpose>("personal");
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [visibility, setVisibility] = useState<CalendarVisibility>("private");
  // 만들면서 같이 초대할 사람들 — 캘린더가 생긴 뒤에야 초대할 수 있어 모아둔다
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const addInvite = () => {
    const handle = inviteHandle.trim().replace(/^@/, "");
    if (!handle || invites.includes(handle)) return setInviteHandle("");
    setInvites((prev) => [...prev, handle]);
    setInviteHandle("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    startTransition(async () => {
      const res = await createNativeCalendar({
        name,
        purpose,
        color,
        visibility,
      });
      if (res.error) return toast.error(res.error);

      // 캘린더는 이미 만들어졌으므로, 초대가 실패해도 되돌리지 않고 알리기만 한다.
      const failed: string[] = [];
      if (res.id && invites.length > 0) {
        for (const handle of invites) {
          const invited = await fetch(`/api/v1/calendars/${res.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: handle, role: inviteRole }),
          });
          if (!invited.ok) failed.push(handle);
        }
      }
      if (failed.length > 0) {
        toast.error(
          `캘린더는 만들었어요. @${failed.join(", @")} 초대는 실패해서 편집에서 다시 시도해 주세요.`,
        );
      } else {
        toast.success("캘린더를 만들었어요.");
      }
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="캘린더 이름 (예: 업무, 커플, 사이드 프로젝트)"
        required
        className="w-full rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
      />

      <div className="flex flex-wrap gap-1.5">
        {PURPOSE_OPTIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPurpose(p.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
              purpose === p.value
                ? "bg-navy-500 text-white"
                : "bg-charcoal-800/40 text-charcoal-700 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs uppercase tracking-wider text-charcoal-500">색상</span>
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${
              color === c ? "ring-2 ring-navy-400 ring-offset-1 ring-offset-charcoal-900" : ""
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-charcoal-900/60 p-1">
        {VISIBILITY.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setVisibility(v.value)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              visibility === v.value
                ? "bg-navy-500 text-white"
                : "text-charcoal-400 hover:text-charcoal-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 border-t border-charcoal-800/40 pt-3">
        <p className="text-2xs text-charcoal-500">
          함께 쓸 사람(선택) — 초대한 사람도 이 캘린더에 일정을 기록할 수 있어요.
          만든 뒤에도 추가할 수 있어요.
        </p>
        {invites.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {invites.map((handle) => (
              <li
                key={handle}
                className="flex items-center gap-1.5 rounded-full bg-charcoal-900/60 px-2.5 py-1 text-xs text-charcoal-200"
              >
                @{handle}
                <button
                  type="button"
                  onClick={() =>
                    setInvites((prev) => prev.filter((h) => h !== handle))
                  }
                  className="text-charcoal-600 hover:text-charcoal-300"
                  aria-label={`@${handle} 빼기`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={inviteHandle}
            onChange={(e) => setInviteHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInvite();
              }
            }}
            placeholder="@핸들로 초대"
            className="flex-1 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500/60 focus:outline-none"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-2 text-xs text-charcoal-200 focus:outline-none"
          >
            <option value="editor">함께 기록</option>
            <option value="viewer">보기만</option>
          </select>
          <button
            type="button"
            onClick={addInvite}
            disabled={!inviteHandle.trim()}
            className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-600 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-sm text-charcoal-300 hover:border-charcoal-600"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-400 px-4 py-1.5 text-sm font-semibold text-charcoal-950 hover:bg-navy-400 disabled:opacity-60"
        >
          {pending ? "만드는 중…" : "생성"}
        </button>
      </div>
    </form>
  );
}
