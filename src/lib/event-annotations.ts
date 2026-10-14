/**
 * 일정 주석(1.5.0 A) — 사용자별·일정별 중요도와 완료 후 별점. 본인만 본다.
 * 키는 toEventKey 형식(Orbit42 일정 = events.id, 구글 일정 = gcal_<id>). 구글에는 쓰지 않는다.
 * 호출하는 쪽이 세션에서 얻은 userId 를 넘긴다 — 다른 사람의 userId 로 부르지 않는다.
 */
import { getAdminClient } from "@/lib/supabase";
import { toEventKey } from "@/lib/event-key";
import { seriesIdOf, parseOccurrenceId } from "@/lib/recurrence";

export type Importance = -1 | 0 | 1;

export type EventAnnotation = {
  importance: Importance;
  rating: number | null;
  ratingNote: string | null;
  /** 일정별 알림 시점 — null = 기본값, -1 = 없음, 0 = 정각, 분 = 그만큼 전 */
  reminderMinutes: number | null;
  /** 다시 알림 시각 — 지났으면 끝난 것 */
  remindAt: string | null;
};

/** API 표기 — "low" | "normal" | "high" */
export const IMPORTANCE_NAMES: Record<Importance, string> = { [-1]: "low", 0: "normal", 1: "high" };

export function parseImportance(raw: unknown): Importance | null {
  if (raw === "low") return -1;
  if (raw === "normal") return 0;
  if (raw === "high") return 1;
  return null;
}

/** 주어진 일정들의 주석 — 없는 일정은 빠진다(= 보통, 별점 없음). */
export async function getAnnotations(
  userId: string,
  eventIds: string[],
): Promise<Map<string, EventAnnotation>> {
  const keys = Array.from(new Set(eventIds.map(toEventKey)));
  const out = new Map<string, EventAnnotation>();
  if (keys.length === 0) return out;
  const db = getAdminClient();
  for (let i = 0; i < keys.length; i += 300) {
    const { data } = await db
      .from("event_annotations")
      .select("event_key, importance, rating, rating_note, reminder_minutes, remind_at")
      .eq("user_id", userId)
      .in("event_key", keys.slice(i, i + 300));
    for (const r of data ?? []) {
      out.set(r.event_key as string, {
        importance: r.importance as Importance,
        rating: (r.rating as number | null) ?? null,
        ratingNote: (r.rating_note as string | null) ?? null,
        reminderMinutes: (r.reminder_minutes as number | null) ?? null,
        remindAt: (r.remind_at as string | null) ?? null,
      });
    }
  }
  return out;
}

export type AnnotationPatch = {
  importance?: Importance;
  /** null 이면 별점 지움 */
  rating?: number | null;
  ratingNote?: string | null;
  /** null = 기본값으로 되돌림 */
  reminderMinutes?: number | null;
  /** 다시 알림 시각 (null = 취소) */
  remindAt?: string | null;
};

export async function upsertAnnotation(
  userId: string,
  eventId: string,
  patch: AnnotationPatch,
): Promise<EventAnnotation> {
  const db = getAdminClient();
  const key = toEventKey(eventId);
  const row: Record<string, unknown> = {
    user_id: userId,
    event_key: key,
    updated_at: new Date().toISOString(),
  };
  if (patch.importance !== undefined) row.importance = patch.importance;
  if (patch.rating !== undefined) {
    row.rating = patch.rating;
    row.rated_at = patch.rating == null ? null : new Date().toISOString();
  }
  if (patch.ratingNote !== undefined) row.rating_note = patch.ratingNote || null;
  if (patch.reminderMinutes !== undefined) row.reminder_minutes = patch.reminderMinutes;
  if (patch.remindAt !== undefined) row.remind_at = patch.remindAt;
  const { data, error } = await db
    .from("event_annotations")
    .upsert(row, { onConflict: "user_id,event_key" })
    .select("importance, rating, rating_note, reminder_minutes, remind_at")
    .single();
  if (error || !data) throw new Error("annotation upsert failed");
  return {
    importance: data.importance as Importance,
    rating: (data.rating as number | null) ?? null,
    ratingNote: (data.rating_note as string | null) ?? null,
    reminderMinutes: (data.reminder_minutes as number | null) ?? null,
    remindAt: (data.remind_at as string | null) ?? null,
  };
}

/** 일정 키가 바뀔 때(캘린더 이동) 주석도 따라 옮긴다. */
export async function migrateAnnotationKey(userId: string, fromId: string, toId: string) {
  const db = getAdminClient();
  await db
    .from("event_annotations")
    .update({ event_key: toEventKey(toId) })
    .eq("user_id", userId)
    .eq("event_key", toEventKey(fromId));
}

export type RatedEvent = {
  eventId: string;
  /** 지금 일정에서 읽은 제목 — 지워졌거나 구글 연결이 끊겨 못 찾으면 null(목록에 "지워진 일정") */
  title: string | null;
  startAt: string | null;
  calendarId: string | null;
  rating: number;
  ratingNote: string | null;
  missing: boolean;
};

const WEEKS = 8;

/**
 * 별점 모아 보기 — 지난 8주. 이번 주·지난주 평균(KST 월요일 시작, 일정 시작 기준), 높은/낮은 일정, 캘린더별 평균.
 * 일정 제목·시각은 저장하지 않고 읽을 때 붙인다: Orbit42 일정은 events 에서, 구글 일정은 기간 안을
 * 캘린더 화면과 같은 방식으로 달마다 한 번씩 읽어 맞춘다(일정마다 호출하지 않음).
 * 못 찾는 일정은 평균에는 넣고 목록에는 "지워진 일정"으로 남긴다(시각을 모르면 이번 주·지난주에선 빠짐).
 */
export async function ratingSummary(userId: string, now = new Date()) {
  const db = getAdminClient();
  const since = new Date(now.getTime() - WEEKS * 7 * 86_400_000);
  const { data } = await db
    .from("event_annotations")
    .select("event_key, rating, rating_note, rated_at")
    .eq("user_id", userId)
    .not("rating", "is", null)
    .gte("rated_at", since.toISOString())
    .order("rated_at", { ascending: false })
    .limit(1000);
  const rated = data ?? [];

  // 일정 정보 붙이기 — Orbit42 일정은 id 로, 구글 일정은 기간 안 목록에서
  const info = new Map<string, { title: string; startAt: string; calendarId: string | null }>();
  const localIds = rated.map((r) => r.event_key as string).filter((k) => !k.startsWith("gcal_"));
  for (let i = 0; i < localIds.length; i += 300) {
    const { data: evs } = await db
      .from("events")
      .select("id, title, start_at, calendar_id")
      .in("id", Array.from(new Set(localIds.slice(i, i + 300).map(seriesIdOf))));
    const byId = new Map((evs ?? []).map((e) => [e.id as string, e]));
    // 반복 회차 키는 시리즈의 제목·캘린더 + 회차의 원래 시작(1.5.1)
    for (const key of localIds.slice(i, i + 300)) {
      const e = byId.get(seriesIdOf(key));
      if (!e) continue;
      const occ = parseOccurrenceId(key);
      info.set(key, { title: e.title as string, startAt: occ ? occ.originalStart.toISOString() : (e.start_at as string), calendarId: (e.calendar_id as string | null) ?? null });
    }
  }
  if (rated.some((r) => (r.event_key as string).startsWith("gcal_"))) {
    const { listEventsForUser } = await import("@/lib/calendar-events");
    // 별점은 일정을 끝낸 뒤 주므로 일정 시작은 rated_at 보다 앞이다 — 기간 앞쪽에 한 주를 더 본다
    const from = new Date(since.getTime() - 7 * 86_400_000);
    const months: Array<[number, number]> = [];
    const c = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (c <= now) {
      months.push([c.getUTCFullYear(), c.getUTCMonth()]);
      c.setUTCMonth(c.getUTCMonth() + 1);
    }
    const lists = await Promise.all(months.map(([y, m]) => listEventsForUser(userId, y, m)));
    for (const e of lists.flat()) {
      if (e.source === "google") info.set(e.id, { title: e.title, startAt: e.start_at, calendarId: e.calendar_id });
    }
  }

  const rows: RatedEvent[] = rated.map((r) => {
    const key = r.event_key as string;
    const found = info.get(key);
    return {
      eventId: key,
      title: found?.title ?? null,
      startAt: found?.startAt ?? null,
      calendarId: found?.calendarId ?? null,
      rating: r.rating as number,
      ratingNote: (r.rating_note as string | null) ?? null,
      missing: !found,
    };
  });

  const kstNow = new Date(now.getTime() + 9 * 3_600_000);
  const dow = (kstNow.getUTCDay() + 6) % 7;
  const thisWeek = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - dow) - 9 * 3_600_000;
  const lastWeek = thisWeek - 7 * 86_400_000;
  const avg = (xs: RatedEvent[]) =>
    xs.length === 0 ? null : Math.round((xs.reduce((s, x) => s + x.rating, 0) / xs.length) * 10) / 10;
  const at = (r: RatedEvent) => (r.startAt ? Date.parse(r.startAt) : NaN);
  const inThis = rows.filter((r) => at(r) >= thisWeek && at(r) < thisWeek + 7 * 86_400_000);
  const inLast = rows.filter((r) => at(r) >= lastWeek && at(r) < thisWeek);
  const recent = (a: RatedEvent, b: RatedEvent) => (at(b) || 0) - (at(a) || 0);

  const byCal = new Map<string, RatedEvent[]>();
  for (const r of rows) {
    const k = r.calendarId ?? "";
    byCal.set(k, [...(byCal.get(k) ?? []), r]);
  }
  return {
    weeks: WEEKS,
    thisWeek: { average: avg(inThis), count: inThis.length },
    lastWeek: { average: avg(inLast), count: inLast.length },
    top: rows.filter((r) => r.rating >= 4).sort((a, b) => b.rating - a.rating || recent(a, b)).slice(0, 10),
    bottom: rows.filter((r) => r.rating <= 2).sort((a, b) => a.rating - b.rating || recent(a, b)).slice(0, 10),
    // calendarId 가 null 이면 '지워진 일정' 묶음
    byCalendar: Array.from(byCal.entries())
      .map(([calendarId, xs]) => ({ calendarId: calendarId || null, average: avg(xs), count: xs.length }))
      .sort((a, b) => b.count - a.count),
    average: avg(rows),
    total: rows.length,
  };
}


export type ActiveReminder = {
  eventId: string;
  remindAt: string;
  /** 지금 일정에서 읽은 값 — 지워졌거나 구글 연결이 끊겨 못 찾으면 null */
  title: string | null;
  startAt: string | null;
  allDay: boolean;
  calendarId: string | null;
  missing: boolean;
};

/** 걸려 있는 다시 알림(지금 이후) — 일정 제목·시각은 읽을 때 붙인다(구글 일정은 저장하지 않음). */
export async function listActiveReminders(userId: string, now = new Date()): Promise<ActiveReminder[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("event_annotations")
    .select("event_key, remind_at")
    .eq("user_id", userId)
    .gt("remind_at", now.toISOString())
    .order("remind_at", { ascending: true })
    // 기기 알림 한도(64)보다 많이 받아도 예약할 수 없다 — 구글 events.get 도 최대 64번
    .limit(64);
  const rows = data ?? [];
  const info = new Map<string, { title: string; startAt: string; allDay: boolean; calendarId: string | null }>();
  const localIds = rows.map((r) => r.event_key as string).filter((k) => !k.startsWith("gcal_"));
  if (localIds.length > 0) {
    const { data: evs } = await db.from("events").select("id, title, start_at, all_day, calendar_id").in("id", Array.from(new Set(localIds.map(seriesIdOf))));
    const byId = new Map((evs ?? []).map((e) => [e.id as string, e]));
    for (const key of localIds) {
      const e = byId.get(seriesIdOf(key));
      if (!e) continue;
      const occ = parseOccurrenceId(key);
      info.set(key, { title: e.title as string, startAt: occ ? occ.originalStart.toISOString() : (e.start_at as string), allDay: !!e.all_day, calendarId: (e.calendar_id as string | null) ?? null });
    }
  }
  const googleIds = rows.map((r) => r.event_key as string).filter((k) => k.startsWith("gcal_"));
  if (googleIds.length > 0) {
    const { getGoogleEventsByIds } = await import("@/lib/calendar-events");
    const found = await getGoogleEventsByIds(userId, googleIds);
    for (const [k, v] of Array.from(found.entries())) info.set(k, { title: v.title, startAt: v.start_at, allDay: v.all_day, calendarId: v.calendar_id });
  }
  return rows.map((r) => {
    const key = r.event_key as string;
    const f = info.get(key);
    return {
      eventId: key,
      remindAt: r.remind_at as string,
      title: f?.title ?? null,
      startAt: f?.startAt ?? null,
      allDay: f?.allDay ?? false,
      calendarId: f?.calendarId ?? null,
      missing: !f,
    };
  });
}
