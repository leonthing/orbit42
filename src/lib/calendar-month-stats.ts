import type { calendar_v3 } from "googleapis";
import { getAuthenticatedCalendar } from "@/lib/google";
import { selectEventsInRange } from "@/lib/recurrence-db";
import { eventDaysInMonth, kstMonthRange, type KstEv as Ev } from "@/lib/kst";
export { kstYearMonth } from "@/lib/kst";
import { googleAllDayEndToInclusive } from "@/lib/calendar-events";

/**
 * 프로필 캘린더 카드(웹·v1)의 '이번 달 N개'와 일정 있는 날 — 11/22 버그 1.
 * 전에는 Orbit42 DB(events)만 세서 구글 연동 캘린더는 늘 0개였고, 달 범위를 서버 시각(UTC)으로 잡았다.
 * 이제 캘린더 화면과 같은 출처(DB 반복 회차 + 구글 singleEvents)를 KST 달로 센다.
 * - 부르는 쪽이 이미 보는 사람에게 보여도 되는 캘린더만 넘긴다(공개 범위는 여기서 넓히지 않는다).
 * - 구글은 캘린더마다 한 번(쪽 넘김만 추가), 토큰은 한 번만 꺼낸다. 구글 캘린더가 없으면 토큰도 안 꺼낸다.
 * - 구글이 실패·시간 초과면 그 캘린더만 failed — 카드가 '불러오지 못했어요'로 그리고 나머지는 그대로.
 */
export type CalendarMonthStat = {
  days: number[];
  count: number;
  failed: boolean;
};

export type StatCalendar = {
  id: string;
  source?: string | null;
  google_calendar_id?: string | null;
};

/** 카드에서 구글을 기다리는 최대 시간 — 넘으면 그 캘린더만 '불러오지 못했어요' */
export const CARD_GOOGLE_TIMEOUT_MS = 4_000;

function addStat(
  map: Map<string, { days: Set<number>; count: number }>,
  calId: string,
  e: Ev,
  y: number,
  m: number,
) {
  const days = eventDaysInMonth(e, y, m);
  if (days.length === 0) return; // 경계 밖(앞달 시간 일정 등)은 세지 않는다
  const s = map.get(calId) ?? { days: new Set<number>(), count: 0 };
  s.count += 1;
  for (const d of days) s.days.add(d);
  map.set(calId, s);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => {
        t = setTimeout(() => rej(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export async function calendarMonthStats(
  ownerId: string,
  calendars: StatCalendar[],
  year: number,
  month: number,
  opts: { googleTimeoutMs?: number } = {},
): Promise<Map<string, CalendarMonthStat>> {
  const timeoutMs = opts.googleTimeoutMs ?? CARD_GOOGLE_TIMEOUT_MS;
  const { from, to } = kstMonthRange(year, month);
  const acc = new Map<string, { days: Set<number>; count: number }>();
  const failed = new Set<string>();

  const native = calendars.filter((c) => c.source !== "google");
  const googleCals = calendars.filter(
    (c) => c.source === "google" && c.google_calendar_id,
  );

  const nativeTask = (async () => {
    if (native.length === 0) return;
    try {
      const rows = await selectEventsInRange<
        Record<string, unknown> & { id: string; start_at: string }
      >({
        columns: "id, calendar_id, start_at, end_at, all_day",
        scope: (q) =>
          q.in(
            "calendar_id",
            native.map((c) => c.id),
          ),
        from,
        to: new Date(to.getTime() - 1),
        spanAllDay: true,
      });
      for (const r of rows ?? []) {
        addStat(acc, r.calendar_id as string, r as unknown as Ev, year, month);
      }
    } catch {
      for (const c of native) failed.add(c.id);
    }
  })();

  const googleTask = (async () => {
    if (googleCals.length === 0) return;
    let cal: calendar_v3.Calendar | null = null;
    try {
      cal = await withTimeout(getAuthenticatedCalendar(ownerId), timeoutMs);
    } catch {
      cal = null;
    }
    if (!cal) {
      for (const c of googleCals) failed.add(c.id);
      return;
    }
    const client = cal;
    await Promise.all(
      googleCals.map(async (c) => {
        try {
          const items = await withTimeout(
            (async () => {
              const out: calendar_v3.Schema$Event[] = [];
              let pageToken: string | undefined;
              for (let page = 0; page < 10; page++) {
                const res = await client.events.list(
                  {
                    calendarId: c.google_calendar_id as string,
                    timeMin: from.toISOString(),
                    timeMax: to.toISOString(),
                    singleEvents: true,
                    maxResults: 250,
                    pageToken,
                    fields: "nextPageToken,items(start,end,status)",
                  },
                  { timeout: timeoutMs },
                );
                out.push(...(res.data.items ?? []));
                pageToken = res.data.nextPageToken ?? undefined;
                if (!pageToken) break;
              }
              return out;
            })(),
            timeoutMs,
          );
          for (const it of items) {
            if (it.status === "cancelled") continue;
            const start = it.start?.dateTime || it.start?.date;
            if (!start) continue;
            const end =
              it.end?.dateTime ||
              (it.end?.date
                ? googleAllDayEndToInclusive(
                    it.end.date,
                    it.start?.date ?? undefined,
                  )
                : null);
            addStat(
              acc,
              c.id,
              { start_at: start, end_at: end, all_day: !!it.start?.date },
              year,
              month,
            );
          }
        } catch {
          failed.add(c.id);
        }
      }),
    );
  })();

  await Promise.all([nativeTask, googleTask]);

  const out = new Map<string, CalendarMonthStat>();
  for (const c of calendars) {
    const s = acc.get(c.id);
    out.set(c.id, {
      days: s ? Array.from(s.days).sort((a, b) => a - b) : [],
      count: s?.count ?? 0,
      failed: failed.has(c.id),
    });
  }
  return out;
}
