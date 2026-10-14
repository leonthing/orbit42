/**
 * 반복 일정 쓰기 (1.5.1 2단계).
 *
 * Orbit42 일정(events.rrule)
 * - 이 일정만  : 회차 예외(event_recurrence_exceptions)에 바뀐 값을 남긴다 / 지우기는 cancelled.
 * - 모두      : 시리즈 행을 고친다. 시간을 바꾸면 고친 회차의 '원래 시작 → 새 시작' 만큼 시리즈 전체를 민다.
 * - 이후 모두  : 시리즈를 그 회차 전날까지로 자르고(UNTIL), 그 회차부터 새 행(새 시리즈)을 만든다.
 * 구글 일정(반복 회차 = singleEvents 로 펼친 instance)
 * - 이 일정만  : instance 를 patch/delete (원래 하던 것).
 * - 모두      : master(recurringEventId)를 patch/delete. 이후 모두는 하지 않는다(시리즈가 쪼개져 되돌리기 어려움).
 * 참석자 알림(sendUpdates=all)은 앱 확인 창을 거친 notifyAttendees=true 일 때만.
 */
import { getAdminClient } from "@/lib/supabase";
import {
  parseRRule,
  parseOccurrenceId,
  computeRecurrenceUntil,
  occurrenceStarts,
  occurrenceId,
} from "@/lib/recurrence";
import { inclusiveAllDayEndToGoogle, googleAllDayEndToInclusive, migrateEventKeys } from "@/lib/calendar-events";
import type { calendar_v3 } from "googleapis";

export type Scope = "this" | "following" | "all";

export type SeriesPatch = {
  title?: string;
  description?: string | null;
  location?: string | null;
  /** 좌표·이동시간 — 시리즈 행에만(회차 예외에는 칸이 없다) */
  location_lat?: number | null;
  location_lng?: number | null;
  travel_min?: number | null;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  /** 반복 규칙 바꾸기(모두일 때만). null 이면 반복 해제 */
  rrule?: string | null;
  is_anniversary?: boolean;
};

const DAY_MS = 86_400_000;

/** 앱이 보낸 RRULE 을 우리가 펼칠 수 있는 꼴인지 확인하고 "RRULE:" 없이 돌려준다. 안 되면 null. */
export function normalizeRRule(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const body = raw.trim().replace(/^RRULE:/i, "");
  if (body.length > 200 || !parseRRule(body)) return null;
  return body.toUpperCase();
}

type SeriesRow = {
  id: string;
  user_id: string;
  calendar_id: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  rrule: string | null;
  is_anniversary: boolean;
};

async function loadSeries(userId: string, seriesId: string): Promise<SeriesRow> {
  const db = getAdminClient();
  const { data } = await db
    .from("events")
    .select("id, user_id, calendar_id, start_at, end_at, all_day, rrule, is_anniversary")
    .eq("id", seriesId)
    .maybeSingle();
  if (!data) throw new Error("일정을 찾을 수 없어요.");
  if (data.user_id !== userId) {
    const { canEditCalendar } = await import("@/lib/calendar-members");
    if (!data.calendar_id || !(await canEditCalendar(userId, data.calendar_id as string))) {
      throw new Error("이 일정을 고칠 권한이 없어요.");
    }
  }
  return data as SeriesRow;
}

/**
 * 회차에 붙은 기록(완료·별점·중요도·알림·자산 분류·수익·글·참석자)은 회차 id 로 저장돼 있다.
 * 시리즈를 밀거나 나누면 회차 id 가 바뀌므로, 기록이 있는 회차만 찾아 새 id 로 옮긴다.
 * remap 이 null 을 주면 그 회차는 그대로 둔다.
 */
async function rekeySeriesOccurrences(
  userId: string,
  seriesId: string,
  remap: (originalStart: Date) => { seriesId: string; originalStart: Date } | null,
  allDay: boolean,
) {
  const db = getAdminClient();
  const like = `%${seriesId}\\_%`;
  const tables = ["event_annotations", "event_completions", "event_bucket_overrides", "event_earnings", "event_posts"];
  const ids = new Set<string>();
  for (const t of tables) {
    const { data } = await db.from(t).select("event_key").eq("user_id", userId).like("event_key", like);
    for (const r of data ?? []) {
      const raw = String(r.event_key).replace(/^local:/, "");
      if (parseOccurrenceId(raw)?.seriesId === seriesId) ids.add(raw);
    }
  }
  for (const oldId of Array.from(ids)) {
    const occ = parseOccurrenceId(oldId)!;
    const to = remap(occ.originalStart);
    if (!to) continue;
    const newId = occurrenceId(to.seriesId, to.originalStart, allDay);
    if (newId !== oldId) await migrateEventKeys(userId, oldId, newId);
  }
}

// ── Orbit42 일정 ─────────────────────────────────────────

/** 이 일정만 고치기 — 회차 예외에 바뀐 값만 남긴다. */
export async function patchNativeOccurrence(userId: string, occId: string, patch: SeriesPatch) {
  const occ = parseOccurrenceId(occId);
  if (!occ) throw new Error("반복 회차가 아니에요.");
  await loadSeries(userId, occ.seriesId);
  const db = getAdminClient();
  const row: Record<string, unknown> = {
    event_id: occ.seriesId,
    original_start: occ.originalStart.toISOString(),
    cancelled: false,
    updated_at: new Date().toISOString(),
  };
  if (patch.start_at !== undefined) row.start_at = patch.start_at;
  if (patch.end_at !== undefined) row.end_at = patch.end_at;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description ?? "";
  if (patch.location !== undefined) row.location = patch.location ?? "";
  const { error } = await db.from("event_recurrence_exceptions").upsert(row, { onConflict: "event_id,original_start" });
  if (error) throw new Error("이 회차를 고치지 못했어요.");
}

/** 이 일정만 지우기 */
export async function deleteNativeOccurrence(userId: string, occId: string) {
  const occ = parseOccurrenceId(occId);
  if (!occ) throw new Error("반복 회차가 아니에요.");
  await loadSeries(userId, occ.seriesId);
  const db = getAdminClient();
  const { error } = await db.from("event_recurrence_exceptions").upsert(
    { event_id: occ.seriesId, original_start: occ.originalStart.toISOString(), cancelled: true, updated_at: new Date().toISOString() },
    { onConflict: "event_id,original_start" },
  );
  if (error) throw new Error("이 회차를 지우지 못했어요.");
}

/**
 * 모두 고치기 — 시리즈 행. 시간이 바뀌면 고친 회차(editedOriginalStart) 기준으로 밀린 만큼 시리즈 시작을 민다.
 * 예외의 원래 시작도 같이 밀어 회차 키가 맞게 따라가게 한다.
 */
export async function patchNativeSeries(
  userId: string,
  seriesId: string,
  patch: SeriesPatch,
  editedOriginalStart: Date | null,
) {
  const series = await loadSeries(userId, seriesId);
  const db = getAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.location_lat !== undefined) update.location_lat = patch.location_lat;
  if (patch.location_lng !== undefined) update.location_lng = patch.location_lng;
  if (patch.travel_min !== undefined) update.travel_min = patch.travel_min;
  if (patch.all_day !== undefined) update.all_day = patch.all_day;
  if (patch.is_anniversary !== undefined) update.is_anniversary = patch.is_anniversary;

  let newStart = new Date(series.start_at);
  let shiftMs = 0;
  if (patch.start_at !== undefined && patch.end_at !== undefined) {
    const anchor = editedOriginalStart ?? new Date(series.start_at);
    shiftMs = Date.parse(patch.start_at) - anchor.getTime();
    const duration = Date.parse(patch.end_at) - Date.parse(patch.start_at);
    newStart = new Date(Date.parse(series.start_at) + shiftMs);
    update.start_at = newStart.toISOString();
    update.end_at = new Date(newStart.getTime() + Math.max(0, duration)).toISOString();
  }
  const rrule = patch.rrule !== undefined ? patch.rrule : series.rrule;
  if (patch.rrule !== undefined) update.rrule = patch.rrule;
  const allDay = patch.all_day ?? series.all_day;
  update.recurrence_until = rrule ? computeRecurrenceUntil(newStart, rrule, allDay)?.toISOString() ?? null : null;

  const { error } = await db.from("events").update(update).eq("id", seriesId);
  if (error) throw new Error("반복 일정을 고치지 못했어요.");

  if (patch.rrule === null) {
    // 반복을 끄면 회차 예외는 의미가 없다
    await db.from("event_recurrence_exceptions").delete().eq("event_id", seriesId);
  } else if (shiftMs !== 0) {
    await rekeySeriesOccurrences(userId, seriesId, (o) => ({ seriesId, originalStart: new Date(o.getTime() + shiftMs) }), allDay);
    // 예외의 원래 시작도 같이 민다 — 회차 키(완료·별점 등)는 원래 시작 기준이라 키도 함께 옮긴다
    const { data: exs } = await db.from("event_recurrence_exceptions").select("*").eq("event_id", seriesId);
    for (const ex of exs ?? []) {
      const from = new Date(ex.original_start as string);
      const to = new Date(from.getTime() + shiftMs);
      await db.from("event_recurrence_exceptions").delete().eq("event_id", seriesId).eq("original_start", ex.original_start);
      await db.from("event_recurrence_exceptions").insert({ ...ex, original_start: to.toISOString() });
    }
  }
}

/** 모두 지우기 */
export async function deleteNativeSeries(userId: string, seriesId: string) {
  await loadSeries(userId, seriesId);
  const { error } = await getAdminClient().from("events").delete().eq("id", seriesId);
  if (error) throw new Error("반복 일정을 지우지 못했어요.");
}

/** 원래 규칙을 그 회차 전까지로 자른다 — COUNT 는 UNTIL 로 바꾼다. 남는 회차가 없으면 null. */
function truncateRule(series: SeriesRow, beforeStart: Date): string | null {
  const rule = parseRRule(series.rrule);
  if (!rule) return null;
  const allDay = series.all_day;
  const kept = occurrenceStarts(new Date(series.start_at), rule, allDay, new Date(beforeStart.getTime() - 1000));
  if (kept.length === 0) return null;
  const last = kept[kept.length - 1];
  const until = allDay
    ? last.toISOString().slice(0, 10).replace(/-/g, "")
    : `${last.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const parts = (series.rrule ?? "").replace(/^RRULE:/i, "").split(";").filter((p) => !/^(COUNT|UNTIL)=/i.test(p));
  return [...parts, `UNTIL=${until}`].join(";");
}

/** 남은 COUNT — 원래 COUNT 에서 자르기 전까지 쓴 회차 수를 뺀다 */
function remainingRule(series: SeriesRow, fromStart: Date): string {
  const rule = parseRRule(series.rrule)!;
  const body = (series.rrule ?? "").replace(/^RRULE:/i, "");
  if (rule.count === undefined) return body;
  const used = occurrenceStarts(new Date(series.start_at), rule, series.all_day, new Date(fromStart.getTime() - 1000)).length;
  const left = Math.max(1, rule.count - used);
  return body.replace(/COUNT=\d+/i, `COUNT=${left}`);
}

/**
 * 이후 모두 — 시리즈를 그 회차 전까지로 자르고 그 회차부터 새 시리즈를 만든다(바뀐 값 반영).
 * 그 회차 이후의 예외는 새 시리즈로 옮긴다. 새 시리즈 id 를 돌려준다.
 */
export async function splitNativeSeries(userId: string, occId: string, patch: SeriesPatch): Promise<string> {
  const occ = parseOccurrenceId(occId);
  if (!occ) throw new Error("반복 회차가 아니에요.");
  const series = await loadSeries(userId, occ.seriesId);
  const db = getAdminClient();
  const { data: full } = await db.from("events").select("*").eq("id", series.id).single();
  if (!full) throw new Error("일정을 찾을 수 없어요.");

  const duration = series.end_at ? Date.parse(series.end_at) - Date.parse(series.start_at) : 0;
  const newStart = patch.start_at ? new Date(patch.start_at) : occ.originalStart;
  const newEnd = patch.end_at ? new Date(patch.end_at) : new Date(newStart.getTime() + duration);
  const shiftMs = newStart.getTime() - occ.originalStart.getTime();
  const rrule = patch.rrule !== undefined ? patch.rrule : remainingRule(series, occ.originalStart);

  const { id: _oldId, created_at: _c, updated_at: _u, ...copy } = full as Record<string, unknown>;
  void _oldId; void _c; void _u;
  const allDay = patch.all_day ?? series.all_day;
  const insert = {
    ...copy,
    title: patch.title ?? copy.title,
    description: patch.description !== undefined ? patch.description : copy.description,
    location: patch.location !== undefined ? patch.location : copy.location,
    location_lat: patch.location_lat !== undefined ? patch.location_lat : copy.location_lat,
    location_lng: patch.location_lng !== undefined ? patch.location_lng : copy.location_lng,
    travel_min: patch.travel_min !== undefined ? patch.travel_min : copy.travel_min,
    all_day: allDay,
    is_anniversary: patch.is_anniversary ?? copy.is_anniversary,
    start_at: newStart.toISOString(),
    end_at: newEnd.toISOString(),
    rrule,
    recurrence_until: rrule ? computeRecurrenceUntil(newStart, rrule, allDay)?.toISOString() ?? null : null,
  };
  const { data: created, error } = await db.from("events").insert(insert).select("id").single();
  if (error || !created) throw new Error("이후 일정을 나누지 못했어요.");

  // 그 회차부터의 예외는 새 시리즈로(원래 시작은 밀린 만큼)
  const { data: exs } = await db.from("event_recurrence_exceptions").select("*").eq("event_id", series.id).gte("original_start", occ.originalStart.toISOString());
  for (const ex of exs ?? []) {
    await db.from("event_recurrence_exceptions").delete().eq("event_id", series.id).eq("original_start", ex.original_start);
    if (Date.parse(ex.original_start as string) === occ.originalStart.getTime()) continue; // 이번에 고친 회차는 새 시리즈 첫 회
    const moved = new Date(Date.parse(ex.original_start as string) + shiftMs).toISOString();
    await db.from("event_recurrence_exceptions").insert({ ...ex, event_id: created.id, original_start: moved });
  }

  await rekeySeriesOccurrences(
    userId,
    series.id,
    (o) => (o.getTime() >= occ.originalStart.getTime() ? { seriesId: created.id as string, originalStart: new Date(o.getTime() + shiftMs) } : null),
    series.all_day,
  );

  // 원래 시리즈 자르기 — 남는 회차가 없으면 원래 행을 지운다
  const cut = truncateRule(series, occ.originalStart);
  if (cut) {
    await db.from("events").update({
      rrule: cut,
      recurrence_until: computeRecurrenceUntil(new Date(series.start_at), cut, series.all_day)?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", series.id);
  } else {
    await db.from("events").delete().eq("id", series.id);
  }
  return created.id as string;
}

/** 이후 모두 지우기 — 그 회차 전까지로 자른다 */
export async function deleteNativeFollowing(userId: string, occId: string) {
  const occ = parseOccurrenceId(occId);
  if (!occ) throw new Error("반복 회차가 아니에요.");
  const series = await loadSeries(userId, occ.seriesId);
  const db = getAdminClient();
  const cut = truncateRule(series, occ.originalStart);
  if (!cut) {
    await db.from("events").delete().eq("id", series.id);
    return;
  }
  await db.from("events").update({
    rrule: cut,
    recurrence_until: computeRecurrenceUntil(new Date(series.start_at), cut, series.all_day)?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", series.id);
  await db.from("event_recurrence_exceptions").delete().eq("event_id", series.id).gte("original_start", occ.originalStart.toISOString());
}

/** 시리즈 정보 — 수정 화면의 반복 선택값 */
export async function nativeSeriesInfo(userId: string, id: string) {
  const seriesId = parseOccurrenceId(id)?.seriesId ?? id;
  const s = await loadSeries(userId, seriesId);
  return { rrule: s.rrule, isAnniversary: s.is_anniversary, seriesStart: s.start_at };
}

export { occurrenceId };

// ── 구글 일정 ────────────────────────────────────────────

/**
 * 구글 기념일 — 구글에는 기념일 칸이 없어 master 의 extendedProperties.private.orbit42Anniversary 에 기준일을 둔다
 * (회차가 물려받아 목록에서 n주년을 센다). 2월 29일 매년은 구글이 평년에 건너뛰므로
 * "2월 마지막 날"(BYMONTH=2;BYMONTHDAY=-1)로 넣어 평년 2월 28일에 오게 한다.
 */
const FEB_LAST = ";BYMONTH=2;BYMONTHDAY=-1";
export function googleRRuleFor(rrule: string, startDate: string, anniversary: boolean): string {
  if (anniversary && startDate.slice(5, 10) === "02-29" && /^FREQ=YEARLY(;(COUNT|UNTIL|INTERVAL)=[^;]+)*$/.test(rrule)) {
    return rrule + FEB_LAST;
  }
  return rrule;
}
/** 구글에서 읽은 규칙 → 앱이 아는 꼴(2월 마지막 날 → 매년) */
export function fromGoogleRRule(rrule: string): string {
  return rrule.replace(FEB_LAST, "");
}

type GCal = calendar_v3.Calendar;

/** instance → master id 와 원래 시작 */
async function googleInstance(cal: GCal, gcalId: string, instanceId: string) {
  const { data } = await cal.events.get({ calendarId: gcalId, eventId: instanceId });
  const master = data.recurringEventId ?? null;
  const original = data.originalStartTime?.dateTime ?? data.originalStartTime?.date ?? null;
  return { master, original, instance: data };
}

/** 구글 '모두' 고치기 — master 를 patch. 시간은 고친 회차의 원래 시작 → 새 시작만큼 master 를 민다. */
export async function patchGoogleSeries(
  cal: GCal,
  gcalId: string,
  instanceOrMasterId: string,
  patch: SeriesPatch,
  notifyAttendees: boolean,
): Promise<void> {
  const inst = await googleInstance(cal, gcalId, instanceOrMasterId);
  const masterId = inst.master ?? instanceOrMasterId;
  const { data: master } = await cal.events.get({ calendarId: gcalId, eventId: masterId });
  const body: calendar_v3.Schema$Event = {};
  if (patch.title !== undefined) body.summary = patch.title;
  if (patch.description !== undefined) body.description = patch.description ?? "";
  if (patch.location !== undefined) body.location = patch.location ?? "";
  if (patch.start_at !== undefined && patch.end_at !== undefined) {
    const allDay = patch.all_day ?? !!master.start?.date;
    if (allDay) {
      // 종일은 날짜 문자열끼리 센다(앱이 보낸 시각의 날짜 부분 = 그날) — 시간대 어긋남 없이
      const day = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
      const anchorDate = (inst.original ?? master.start?.date ?? master.start?.dateTime ?? "").slice(0, 10);
      const shiftDays = Math.round((day(patch.start_at) - day(anchorDate)) / DAY_MS);
      const spanDays = Math.max(0, Math.round((day(patch.end_at) - day(patch.start_at)) / DAY_MS));
      const masterDate = (master.start?.date ?? master.start?.dateTime ?? "").slice(0, 10);
      const startDate = new Date(day(masterDate) + shiftDays * DAY_MS).toISOString().slice(0, 10);
      const endDate = new Date(day(startDate) + spanDays * DAY_MS).toISOString().slice(0, 10);
      body.start = { date: startDate, dateTime: null };
      body.end = { date: inclusiveAllDayEndToGoogle(endDate), dateTime: null };
    } else {
      const anchor = inst.original ? Date.parse(inst.original) : Date.parse(master.start?.dateTime ?? "");
      const shift = Date.parse(patch.start_at) - anchor;
      const ns = new Date(Date.parse(master.start?.dateTime ?? "") + shift);
      const duration = Date.parse(patch.end_at) - Date.parse(patch.start_at);
      body.start = { dateTime: ns.toISOString(), timeZone: "Asia/Seoul", date: null };
      body.end = { dateTime: new Date(ns.getTime() + Math.max(0, duration)).toISOString(), timeZone: "Asia/Seoul", date: null };
    }
  }
  const masterDate = (body.start?.date ?? body.start?.dateTime ?? master.start?.date ?? master.start?.dateTime ?? "").slice(0, 10);
  const wasAnniv = !!master.extendedProperties?.private?.orbit42Anniversary;
  const anniv = patch.is_anniversary ?? wasAnniv;
  if (patch.rrule !== undefined || patch.is_anniversary !== undefined || (anniv && body.start)) {
    const current = (master.recurrence ?? []).find((r) => r.toUpperCase().startsWith("RRULE:"));
    const rr = patch.rrule !== undefined ? patch.rrule : current ? fromGoogleRRule(current.replace(/^RRULE:/i, "")) : null;
    body.recurrence = rr ? [`RRULE:${googleRRuleFor(rr, masterDate, anniv && /FREQ=YEARLY/.test(rr))}`] : [];
    if (anniv !== wasAnniv || (anniv && body.start)) {
      body.extendedProperties = { private: { orbit42Anniversary: anniv && rr && /FREQ=YEARLY/.test(rr) ? masterDate : "" } };
    }
  }
  await cal.events.patch({
    calendarId: gcalId,
    eventId: masterId,
    requestBody: body,
    ...(notifyAttendees ? { sendUpdates: "all" } : {}),
  });
}

/** 구글 '모두' 지우기 — master 삭제(sendUpdates 없음: 지금 삭제와 같은 규칙) */
export async function deleteGoogleSeries(cal: GCal, gcalId: string, instanceOrMasterId: string) {
  const inst = await googleInstance(cal, gcalId, instanceOrMasterId);
  await cal.events.delete({ calendarId: gcalId, eventId: inst.master ?? instanceOrMasterId });
}

/** 구글 시리즈 정보 — master 의 RRULE */
export async function googleSeriesInfo(cal: GCal, gcalId: string, instanceOrMasterId: string) {
  const inst = await googleInstance(cal, gcalId, instanceOrMasterId);
  const masterId = inst.master ?? instanceOrMasterId;
  const { data: master } = await cal.events.get({ calendarId: gcalId, eventId: masterId });
  const rr = (master.recurrence ?? []).find((r) => r.toUpperCase().startsWith("RRULE:")) ?? null;
  const start = master.start?.dateTime ?? master.start?.date ?? null;
  return {
    rrule: rr ? fromGoogleRRule(rr.replace(/^RRULE:/i, "")) : null,
    isAnniversary: !!master.extendedProperties?.private?.orbit42Anniversary,
    seriesStart: start,
    seriesEnd: master.end?.date ? googleAllDayEndToInclusive(master.end.date, master.start?.date ?? undefined) : master.end?.dateTime ?? null,
  };
}

export const _test = { truncateRule, remainingRule, DAY_MS };
