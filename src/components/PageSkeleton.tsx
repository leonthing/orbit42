// Lightweight route-level skeletons shown via loading.tsx while the
// server component streams. Calm pulse, matches the dark surface.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-charcoal-800/60 ${className}`} />;
}

/** A stacked-list skeleton — feed, explore, bookings, messages. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <Bar className="h-7 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-charcoal-800/40 bg-charcoal-900/20 p-4"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-charcoal-800/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bar className="h-4 w-1/3" />
              <Bar className="h-3 w-2/3" />
              <Bar className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 프로필 헤더(아바타·이름·탭) + 카드 그리드 — /[username]. */
export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-charcoal-800/60" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-6 w-40" />
          <Bar className="h-4 w-28" />
          <Bar className="h-3 w-2/3" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-charcoal-800/40 bg-charcoal-900/20 p-4"
          >
            <Bar className="h-4 w-1/2" />
            <Bar className="h-3 w-3/4" />
            <Bar className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 통계 타일 + 차트 자리 — /[username]/insights. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <Bar className="h-7 w-44" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-charcoal-800/40 bg-charcoal-900/20 p-4"
          >
            <Bar className="h-3 w-16" />
            <Bar className="h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-charcoal-800/40 bg-charcoal-900/20 p-4">
        <Bar className="h-4 w-32" />
        <Bar className="mt-4 h-48 w-full" />
      </div>
    </div>
  );
}

/** 섹션 제목 + 입력 줄 — 설정·서비스 같은 폼 화면. */
export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <Bar className="h-7 w-32" />
      {Array.from({ length: sections }).map((_, s) => (
        <div
          key={s}
          className="space-y-3 rounded-xl border border-charcoal-800/40 bg-charcoal-900/20 p-5"
        >
          <Bar className="h-4 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="h-10 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 좌우로 엇갈린 말풍선 — /messages/[id]. */
export function ThreadSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <Bar className="h-6 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={i % 2 ? "flex justify-end" : "flex"}>
          <Bar className={`h-12 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
        </div>
      ))}
    </div>
  );
}

/** A week-grid skeleton — calendar. */
export function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="flex items-center justify-between">
        <Bar className="h-7 w-48" />
        <Bar className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Bar key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, col) => (
          <div key={col} className="space-y-2">
            {Array.from({ length: 6 }).map((_, row) => (
              <Bar key={row} className="h-14 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
