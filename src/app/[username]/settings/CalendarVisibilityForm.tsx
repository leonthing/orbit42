"use client";

import { useState, useTransition } from "react";
import { setCalendarVisibility } from "@/lib/calendar-settings";
import type { CalendarVisibility, CalendarSetting } from "@/lib/calendar-settings";
import type { GoogleCalendarInfo } from "../calendar/actions";

const OPTIONS: { value: CalendarVisibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "나만 보기" },
  { value: "followers", label: "Followers", hint: "팔로워만" },
  { value: "public", label: "Public", hint: "전체 공개" },
];

export function CalendarVisibilityForm({
  calendars,
  initialSettings,
}: {
  calendars: GoogleCalendarInfo[];
  initialSettings: CalendarSetting[];
}) {
  const initial: Record<string, CalendarVisibility> = {};
  for (const s of initialSettings) initial[s.google_calendar_id] = s.visibility;

  const [values, setValues] = useState<Record<string, CalendarVisibility>>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handle = (calendarId: string, next: CalendarVisibility) => {
    setValues((v) => ({ ...v, [calendarId]: next }));
    setSavingId(calendarId);
    startTransition(async () => {
      const res = await setCalendarVisibility(calendarId, next);
      setSavingId(null);
      if (res.error) alert(res.error);
    });
  };

  if (calendars.length === 0) {
    return (
      <p className="text-sm text-charcoal-500">
        Google Calendar를 먼저 연결해주세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {calendars.map((cal) => {
        const current = values[cal.id] ?? "private";
        return (
          <div
            key={cal.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-charcoal-100">
                  {cal.summary}
                </p>
                {cal.primary && (
                  <p className="text-xs text-charcoal-500">primary</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-charcoal-900/60 p-1">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handle(cal.id, opt.value)}
                  title={opt.hint}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    current === opt.value
                      ? "bg-navy-600 text-white"
                      : "text-charcoal-400 hover:text-charcoal-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {savingId === cal.id && (
                <span className="ml-1 text-xs text-charcoal-500">…</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
