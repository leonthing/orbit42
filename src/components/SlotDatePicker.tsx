"use client";

import { useMemo, useState } from "react";

export type DatedOption = {
  availability_id: string | null;
  start_at: string;
  end_at: string;
  remaining: number;
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function startOfMonth(y: number, m: number) {
  return new Date(y, m, 1);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
/** Monday-based week offset: Mon=0, Sun=6. */
function weekdayMon0(d: Date) {
  return (d.getDay() + 6) % 7;
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = weekdayMon0(first);
  const grid: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) grid.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    grid.push(new Date(year, month, d));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

/**
 * Calendar-first slot picker. Shows a month grid where dates with
 * availability are selectable; selecting a date reveals AM/PM time
 * groups for that date.
 */
export function SlotDatePicker({
  options,
  selectedKey,
  onSelect,
  keyOf,
}: {
  options: DatedOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  keyOf: (o: DatedOption) => string;
}) {
  const optionsByDay = useMemo(() => {
    const m = new Map<string, DatedOption[]>();
    for (const o of options) {
      const k = dayKey(new Date(o.start_at));
      const list = m.get(k) ?? [];
      list.push(o);
      m.set(k, list);
    }
    return m;
  }, [options]);

  const firstAvailable = useMemo(() => {
    if (options.length === 0) return null;
    const sorted = [...options].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
    return new Date(sorted[0].start_at);
  }, [options]);

  const [cursor, setCursor] = useState<Date>(() =>
    firstAvailable
      ? startOfMonth(firstAvailable.getFullYear(), firstAvailable.getMonth())
      : startOfMonth(new Date().getFullYear(), new Date().getMonth()),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    firstAvailable ? dayKey(firstAvailable) : null,
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = new Date();
  const todayKey = dayKey(today);

  const selectedOpts = selectedDay
    ? (optionsByDay.get(selectedDay) ?? []).sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )
    : [];

  const am = selectedOpts.filter(
    (o) => new Date(o.start_at).getHours() < 12,
  );
  const pm = selectedOpts.filter(
    (o) => new Date(o.start_at).getHours() >= 12,
  );

  return (
    <div className="space-y-5">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-charcoal-100">
          {year}년 {month + 1}월
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="이전 달"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-charcoal-800/60 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="다음 달"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-charcoal-800/60 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={i >= 5 ? "text-charcoal-600" : "text-charcoal-500"}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, idx) => {
          if (!d) return <span key={idx} />;
          const key = dayKey(d);
          const has = optionsByDay.has(key);
          const isSelected = selectedDay === key;
          const isToday = key === todayKey;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const baseClass = has
            ? "cursor-pointer hover:bg-charcoal-800/40"
            : "cursor-default opacity-40";
          const selectedClass = isSelected
            ? "bg-red-600 text-white hover:bg-red-600"
            : isToday
              ? "ring-1 ring-red-500/60"
              : "";
          return (
            <button
              key={idx}
              type="button"
              disabled={!has}
              onClick={() => setSelectedDay(key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors ${baseClass} ${selectedClass} ${
                !isSelected
                  ? isWeekend
                    ? "text-charcoal-500"
                    : "text-charcoal-200"
                  : ""
              }`}
            >
              <span className={isSelected ? "font-bold" : ""}>
                {d.getDate()}
              </span>
              {has && !isSelected && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time groups */}
      {selectedOpts.length === 0 ? (
        <p className="text-xs text-charcoal-500">날짜를 선택하세요.</p>
      ) : (
        <div className="space-y-4">
          {am.length > 0 && (
            <TimeGroup
              label="오전"
              options={am}
              selectedKey={selectedKey}
              onSelect={onSelect}
              keyOf={keyOf}
            />
          )}
          {pm.length > 0 && (
            <TimeGroup
              label="오후"
              options={pm}
              selectedKey={selectedKey}
              onSelect={onSelect}
              keyOf={keyOf}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TimeGroup({
  label,
  options,
  selectedKey,
  onSelect,
  keyOf,
}: {
  label: string;
  options: DatedOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  keyOf: (o: DatedOption) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-charcoal-500">{label}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {options.map((o) => {
          const k = keyOf(o);
          const active = selectedKey === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(k)}
              className={`flex flex-col items-center rounded-md border px-3 py-2 text-sm transition-colors tabular-nums ${
                active
                  ? "border-red-500 bg-red-600/15 font-semibold text-charcoal-100"
                  : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-200 hover:border-charcoal-700"
              }`}
            >
              <span>
                {new Date(o.start_at).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              {o.remaining > 1 && (
                <span className="mt-0.5 text-[10px] font-normal text-charcoal-500">
                  {o.remaining}자리 남음
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only variant for the host's own preview. */
export function SlotDatePreview({ options }: { options: DatedOption[] }) {
  return (
    <SlotDatePicker
      options={options}
      selectedKey=""
      onSelect={() => {}}
      keyOf={(o) => o.availability_id ?? o.start_at}
    />
  );
}
