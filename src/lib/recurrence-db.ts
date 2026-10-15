/**
 * events 를 기간으로 읽는 모든 곳이 쓰는 한 가지 길 (1.5.1).
 * 한 번짜리 일정은 예전과 똑같이 "시작이 기간 안"으로 읽고, 반복 일정(rrule)은 따로 읽어
 * 기간 안의 회차로 펼친다(예외 반영). 반복이 없는 지금 데이터에서는 결과가 예전과 같다.
 *
 * scope 는 각 곳의 거르기(user_id·calendar_id 등)를 두 조회에 똑같이 건다.
 */
import { getAdminClient } from "@/lib/supabase";
import { expandSeries, type RecurrenceException } from "@/lib/recurrence";

// supabase 쿼리 빌더 — 곳마다 거르기를 그대로 거는 데만 쓴다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

const SERIES_COLUMNS = "rrule, recurrence_until, is_anniversary";

export async function selectEventsInRange<T extends { id: string; start_at: string }>(opts: {
  /** 각 곳이 원래 읽던 칸 — 펼치기에 필요한 칸(id·start_at·end_at·all_day)은 알아서 더한다 */
  columns: string;
  scope: (q: Query) => Query;
  from: Date;
  to: Date;
  /** 결과 정렬 (예전 조회의 order("start_at")와 같게) */
  orderByStart?: boolean;
}): Promise<T[]> {
  const db = getAdminClient();
  const cols = opts.columns.trim() === "*" ? "*" : withNeeded(opts.columns);

  let single = opts.scope(db.from("events").select(cols))
    .is("rrule", null)
    .gte("start_at", opts.from.toISOString())
    .lte("start_at", opts.to.toISOString());
  if (opts.orderByStart) single = single.order("start_at", { ascending: true });

  const seriesCols = cols === "*" ? "*" : `${cols}, ${SERIES_COLUMNS}`;
  const series = opts.scope(db.from("events").select(seriesCols))
    .not("rrule", "is", null)
    .lte("start_at", opts.to.toISOString());

  const [singleRes, seriesRes] = await Promise.all([single, series]);
  const singles = (singleRes.data ?? []) as T[];
  const seriesRows = ((seriesRes.data ?? []) as Array<T & { recurrence_until?: string | null }>).filter(
    (r) => !r.recurrence_until || Date.parse(r.recurrence_until) >= opts.from.getTime() - 366 * 86_400_000,
  );
  if (seriesRows.length === 0) return singles;

  const { data: exRows } = await db
    .from("event_recurrence_exceptions")
    .select("event_id, original_start, cancelled, start_at, end_at, title, description, location, location_lat, location_lng, travel_min")
    .in("event_id", seriesRows.map((r) => r.id));
  const exceptions = (exRows ?? []) as RecurrenceException[];

  const expanded = seriesRows.flatMap((r) =>
    expandSeries(r as unknown as Parameters<typeof expandSeries>[0], exceptions, opts.from, opts.to) as unknown as T[],
  );
  const all = [...singles, ...expanded];
  if (opts.orderByStart) all.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  return all;
}

function withNeeded(columns: string): string {
  const have = new Set(columns.split(",").map((c) => c.trim().split(":")[0].trim()));
  const need = ["id", "start_at", "end_at", "all_day"].filter((c) => !have.has(c));
  return need.length ? `${columns}, ${need.join(", ")}` : columns;
}
