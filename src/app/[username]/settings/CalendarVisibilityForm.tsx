"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setCalendarVisibility,
  setCalendarPurpose,
  createGoogleCalendar,
} from "@/lib/calendar-settings";
import {
  PURPOSE_OPTIONS,
  CALENDAR_COLORS,
  type CalendarVisibility,
  type CalendarSetting,
  type CalendarPurpose,
} from "@/lib/calendar-settings-types";
import type { GoogleCalendarInfo } from "../calendar/actions";
import { useToast } from "@/components/Toast";

const VISIBILITY: { value: CalendarVisibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "나만 보기" },
  { value: "followers", label: "Followers", hint: "팔로워만" },
  { value: "public", label: "Public", hint: "전체 공개" },
];

type Row = {
  cal: GoogleCalendarInfo;
  visibility: CalendarVisibility;
  purpose: CalendarPurpose | null;
  labelOverride: string | null;
  colorOverride: string | null;
};

function mergeRows(
  calendars: GoogleCalendarInfo[],
  settings: CalendarSetting[],
): Row[] {
  const byId = new Map(settings.map((s) => [s.google_calendar_id, s]));
  return calendars.map((cal) => {
    const s = byId.get(cal.id);
    return {
      cal,
      visibility: (s?.visibility as CalendarVisibility) ?? "private",
      purpose: (s?.purpose as CalendarPurpose | null) ?? null,
      labelOverride: s?.label_override ?? null,
      colorOverride: s?.color_override ?? null,
    };
  });
}

export function CalendarVisibilityForm({
  calendars,
  initialSettings,
}: {
  calendars: GoogleCalendarInfo[];
  initialSettings: CalendarSetting[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() => mergeRows(calendars, initialSettings));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  const changeVisibility = (id: string, next: CalendarVisibility) => {
    setRows((rs) => rs.map((r) => (r.cal.id === id ? { ...r, visibility: next } : r)));
    setSavingId(id);
    startTransition(async () => {
      const res = await setCalendarVisibility(id, next);
      setSavingId(null);
      if (res.error) toast.error(res.error);
      router.refresh();
    });
  };

  const changePurpose = (id: string, next: CalendarPurpose | null) => {
    setRows((rs) => rs.map((r) => (r.cal.id === id ? { ...r, purpose: next } : r)));
    setSavingId(id);
    startTransition(async () => {
      const res = await setCalendarPurpose(id, next);
      setSavingId(null);
      if (res.error) toast.error(res.error);
      router.refresh();
    });
  };

  if (calendars.length === 0 && !showNew) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-charcoal-500">
          Google Calendar를 먼저 연결해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row) => {
          const id = row.cal.id;
          const purposeMeta = PURPOSE_OPTIONS.find((p) => p.value === row.purpose);
          const color = row.colorOverride || row.cal.backgroundColor;
          const label = row.labelOverride || row.cal.summary;
          return (
            <div
              key={id}
              className="space-y-2 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal-100">
                      {label}
                    </p>
                    <p className="text-xs text-charcoal-500">
                      {row.cal.primary ? "primary" : row.cal.id}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-charcoal-900/60 p-1">
                  {VISIBILITY.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => changeVisibility(id, opt.value)}
                      title={opt.hint}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        row.visibility === opt.value
                          ? "bg-red-600 text-white"
                          : "text-charcoal-400 hover:text-charcoal-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-charcoal-500">
                  용도
                </span>
                <button
                  type="button"
                  onClick={() => changePurpose(id, null)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    row.purpose === null
                      ? "bg-charcoal-700 text-charcoal-100"
                      : "text-charcoal-500 hover:text-charcoal-300"
                  }`}
                >
                  없음
                </button>
                {PURPOSE_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => changePurpose(id, p.value)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                      row.purpose === p.value
                        ? "bg-red-500/25 text-red-200"
                        : "bg-charcoal-900/50 text-charcoal-400 hover:text-charcoal-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {savingId === id && (
                  <span className="text-[10px] text-charcoal-500">저장 중…</span>
                )}
                {purposeMeta && !savingId && (
                  <span className="ml-auto text-[10px] text-charcoal-600">
                    {purposeMeta.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew ? (
        <NewCalendarForm
          onDone={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="w-full rounded-lg border border-dashed border-charcoal-800/60 px-4 py-2.5 text-sm text-charcoal-400 hover:border-red-500/50 hover:text-red-300"
        >
          + 새 캘린더 만들기 (업무/커플/돈 버는 용 등)
        </button>
      )}
    </div>
  );
}

function NewCalendarForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<CalendarPurpose>("work");
  const [color, setColor] = useState<string>(CALENDAR_COLORS[0]);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    startTransition(async () => {
      const res = await createGoogleCalendar({ name, purpose, color });
      if (res.error) return toast.error(res.error);
      setName("");
      onDone();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-charcoal-400">
          이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 업무, 프리랜서 일정"
          required
          className="w-full rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-charcoal-400">용도</p>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSE_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPurpose(p.value)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                purpose === p.value
                  ? "bg-red-500/25 text-red-200"
                  : "bg-charcoal-800/40 text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-charcoal-400">색상</p>
        <div className="flex gap-2">
          {CALENDAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-charcoal-900 transition ${
                color === c ? "ring-2 ring-red-400" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
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
