// Lightweight route-level skeletons shown via loading.tsx while the
// server component streams. Calm pulse, matches the dark surface.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-charcoal-800/60 ${className}`} />;
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
