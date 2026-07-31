import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

export type TimelineEntry = {
  id: string;
  title: string;
  startAt: string;
  hours: number | null;
  allDay: boolean;
  calendarName: string | null;
  calendarColor: string | null;
  goalTitle: string | null;
  imageUrls: string[];
  note: string | null;
  authorName: string | null;
};

const TZ = "Asia/Seoul";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function timeLabel(entry: TimelineEntry) {
  if (entry.allDay) return "종일";
  const time = new Date(entry.startAt).toLocaleTimeString("ko-KR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return entry.hours && entry.hours > 0 ? `${time} · ${entry.hours}시간` : time;
}

/** 타임라인 피드 — 날짜별로 묶고, 사진이 있는 기록은 크게 보여준다. */
export function TimelineFeed({
  entries,
  calendars,
  username,
  scope,
  calendarId,
  onlyPhotos,
}: {
  entries: TimelineEntry[];
  calendars: Array<{ id: string; name: string; color: string; goalTitle: string | null }>;
  username: string;
  scope: string;
  calendarId: string | null;
  onlyPhotos: boolean;
}) {
  const groups: Array<{ key: string; items: TimelineEntry[] }> = [];
  for (const entry of entries) {
    const key = dayLabel(entry.startAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(entry);
    else groups.push({ key, items: [entry] });
  }

  const base = `/${username}/timeline`;
  const href = (next: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged = { scope, calendarId, photos: onlyPhotos ? "1" : null, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "scope" && v === "me")) params.set(k, v);
    }
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  };

  return (
    <div className="space-y-5">
      {/* 스코프 + 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-charcoal-800/60 p-0.5">
          <Link
            href={href({ scope: "me", calendarId: null })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              scope === "me"
                ? "bg-navy-500 text-white"
                : "text-charcoal-400 hover:text-charcoal-200"
            }`}
          >
            내 기록
          </Link>
          <Link
            href={href({ scope: "following", calendarId: null })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              scope === "following"
                ? "bg-navy-500 text-white"
                : "text-charcoal-400 hover:text-charcoal-200"
            }`}
          >
            팔로잉
          </Link>
        </div>

        <Link
          href={href({ photos: onlyPhotos ? null : "1" })}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            onlyPhotos
              ? "border-navy-500/50 bg-navy-500/10 text-navy-400"
              : "border-charcoal-800/60 text-charcoal-500 hover:text-charcoal-300"
          }`}
        >
          사진 있는 기록만
        </Link>

        {scope === "me" && calendars.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={href({ calendarId: null })}
              className={`rounded-full px-2.5 py-1 text-xs ${
                !calendarId
                  ? "bg-charcoal-800 text-charcoal-100"
                  : "text-charcoal-500 hover:text-charcoal-300"
              }`}
            >
              전체
            </Link>
            {calendars.map((c) => (
              <Link
                key={c.id}
                href={href({ calendarId: c.id })}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  calendarId === c.id
                    ? "bg-charcoal-800 text-charcoal-100"
                    : "text-charcoal-500 hover:text-charcoal-300"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.goalTitle ?? c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="아직 기록이 없어요"
          body={
            scope === "following"
              ? "팔로우한 사람들이 완료한 일정이 여기에 보여요."
              : "캘린더에서 완료 체크한 일정이 여기에 쌓여요. 사진을 붙이면 기록이 더 선명해져요."
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="text-xs font-semibold text-charcoal-500">{group.key}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map((entry) => (
                <article
                  key={entry.id}
                  className="overflow-hidden rounded-xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))]"
                >
                  {entry.imageUrls.length > 0 && (
                    <div
                      className={`grid gap-0.5 ${entry.imageUrls.length > 1 ? "grid-cols-2" : ""}`}
                    >
                      {entry.imageUrls.slice(0, 4).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-40 w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5 p-4">
                    {entry.authorName && (
                      <p className="text-xs font-semibold text-charcoal-300">
                        {entry.authorName}
                      </p>
                    )}
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-7 w-0.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.calendarColor ?? "#6366f1" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-charcoal-100">
                          {entry.title}
                        </p>
                        <p className="text-xs text-charcoal-500">
                          {timeLabel(entry)}
                          {entry.calendarName && ` · ${entry.calendarName}`}
                        </p>
                      </div>
                      {entry.goalTitle && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium"
                          style={{
                            color: entry.calendarColor ?? "#6366f1",
                            backgroundColor: `${entry.calendarColor ?? "#6366f1"}26`,
                          }}
                        >
                          {entry.goalTitle}
                        </span>
                      )}
                    </div>
                    {entry.note && (
                      <p className="text-xs text-charcoal-400">{entry.note}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
