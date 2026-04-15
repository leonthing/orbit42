"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createNativeCalendar,
  createGoogleLinkedCalendar,
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
          className="shrink-0 whitespace-nowrap rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
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

  const onDelete = () => {
    if (calendar.is_default) return alert("기본 캘린더는 삭제할 수 없어요.");
    if (
      !confirm(
        calendar.source === "google"
          ? "연결을 해제할까요? (Google에서는 유지됩니다)"
          : "이 캘린더와 안의 일정들을 모두 삭제할까요?",
      )
    )
      return;
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
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-500/30 dark:text-red-200 dark:ring-0">
                  기본
                </span>
              )}
              {calendar.source === "google" && (
                <span className="rounded-full bg-charcoal-800/60 px-2 py-0.5 text-[10px] text-charcoal-700 dark:text-charcoal-300">
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
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                calendar.visibility === v.value
                  ? "bg-red-600 text-white"
                  : "text-charcoal-500 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-charcoal-500">
          용도
        </span>
        <button
          type="button"
          onClick={() => changePurpose(null)}
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] ${
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
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
              calendar.purpose === p.value
                ? "bg-red-600 text-white"
                : "bg-charcoal-900/50 text-charcoal-700 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-charcoal-500">색상</span>
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => changeColor(c)}
            className={`h-5 w-5 rounded-full ${
              color === c ? "ring-2 ring-red-400 ring-offset-1 ring-offset-charcoal-900" : ""
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-md border border-charcoal-800 px-2.5 py-1 text-[11px] text-charcoal-400 hover:border-red-500/50 hover:text-red-400"
        >
          {calendar.source === "google" ? "연결 해제" : "삭제"}
        </button>
      </div>
    </li>
  );
}

function NewCalendarForm({
  googleConnected,
  onDone,
}: {
  googleConnected: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<CalendarPurpose>("personal");
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [visibility, setVisibility] = useState<CalendarVisibility>("private");
  const [alsoGoogle, setAlsoGoogle] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("이름을 입력해주세요.");
    startTransition(async () => {
      const res = alsoGoogle
        ? await createGoogleLinkedCalendar({ name, purpose, color, visibility })
        : await createNativeCalendar({ name, purpose, color, visibility });
      if (res.error) return alert(res.error);
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
                ? "bg-red-600 text-white"
                : "bg-charcoal-800/40 text-charcoal-700 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-charcoal-500">색상</span>
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${
              color === c ? "ring-2 ring-red-400 ring-offset-1 ring-offset-charcoal-900" : ""
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
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              visibility === v.value
                ? "bg-red-600 text-white"
                : "text-charcoal-400 hover:text-charcoal-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <label
        className={`flex items-center gap-2 text-xs ${
          googleConnected ? "text-charcoal-300" : "text-charcoal-600"
        }`}
      >
        <input
          type="checkbox"
          checked={alsoGoogle}
          disabled={!googleConnected}
          onChange={(e) => setAlsoGoogle(e.target.checked)}
          className="accent-red-500"
        />
        Google 캘린더로도 생성 {!googleConnected && "(Google 연결 후 사용 가능)"}
      </label>

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
          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-semibold text-charcoal-950 hover:bg-red-400 disabled:opacity-60"
        >
          {pending ? "만드는 중…" : "생성"}
        </button>
      </div>
    </form>
  );
}
