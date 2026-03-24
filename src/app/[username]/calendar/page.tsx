import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calendar" };

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return days;
}

export default function CalendarPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = getCalendarDays(year, month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Calendar</h1>
          <p className="mt-1 text-sm text-charcoal-500">일정 및 시간 관리</p>
        </div>
        <button className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500">
          + 새 일정
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold text-charcoal-200">
            {year}년 {month + 1}월
          </h2>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-charcoal-500">
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => (
            <div
              key={i}
              className={`flex h-20 flex-col rounded-lg p-2 text-sm ${
                day
                  ? day === today.getDate()
                    ? "bg-navy-600/10 text-navy-400"
                    : "text-charcoal-300 hover:bg-charcoal-800/50"
                  : ""
              }`}
            >
              {day && (
                <span
                  className={`text-xs font-medium ${
                    day === today.getDate()
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-navy-600 text-white"
                      : ""
                  }`}
                >
                  {day}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
