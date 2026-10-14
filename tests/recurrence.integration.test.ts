/**
 * 반복 일정 — events 를 읽는 곳마다 회차가 잡히는지 (운영 DB, 데모 계정 mina, 끝나면 모두 지움).
 * 실행: (로컬 서버 켠 채로) npx tsx --env-file=.env.local --tsconfig tsconfig.json --test tests/recurrence.integration.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { getAdminClient } from "../src/lib/supabase";
import { signSession } from "../src/lib/session";
import { computeRecurrenceUntil, occurrenceId } from "../src/lib/recurrence";
import { listEventsForUser } from "../src/lib/calendar-events";
import { computeAutoAvailability } from "../src/lib/slot-availability";
import { findConflictsForUser } from "../src/lib/mutual-availability";
import { fetchTimeBlocks } from "../src/lib/insights";
import { listNativeEventsInCalendars } from "../src/lib/native-events";
import { upsertAnnotation, ratingSummary, listActiveReminders } from "../src/lib/event-annotations";

const B = "http://localhost:3000";
const kst = (s: string) => new Date(`${s}+09:00`);
const iso = (d: Date) => d.toISOString();
const P = "[테스트반복]";
const db = getAdminClient();
let uid = "";
let cal = "";
let token = "";
const ids: Record<string, string> = {};

async function series(key: string, title: string, start: Date, end: Date, rrule: string, allDay = false, extra: Record<string, unknown> = {}) {
  const { data, error } = await db.from("events").insert({
    user_id: uid, calendar_id: cal, title: `${P} ${title}`, start_at: iso(start), end_at: iso(end), all_day: allDay,
    rrule, recurrence_until: computeRecurrenceUntil(start, rrule, allDay)?.toISOString() ?? null, ...extra,
  }).select("id").single();
  if (error) throw error;
  ids[key] = data!.id as string;
}

before(async () => {
  const { data: u } = await db.from("users").select("id").eq("username", "mina").single();
  uid = u!.id as string;
  const { data: c } = await db.from("calendars").insert({ user_id: uid, name: `${P} 공개`, source: "native", visibility: "public", color: "#10b981", purpose: "personal" }).select("id").single();
  cal = c!.id as string;
  token = await signSession({ username: "mina" });
  await series("weekly", "주간 회의", kst("2026-10-19T10:00:00"), kst("2026-10-19T11:00:00"), "FREQ=WEEKLY;BYDAY=MO;COUNT=6");
  const exRes = await db.from("event_recurrence_exceptions").insert([
    { event_id: ids.weekly, original_start: iso(kst("2026-10-26T10:00:00")), cancelled: true, start_at: null, end_at: null },
    { event_id: ids.weekly, original_start: iso(kst("2026-11-02T10:00:00")), cancelled: false, start_at: iso(kst("2026-11-03T15:00:00")), end_at: iso(kst("2026-11-03T16:00:00")) },
  ]);
  if (exRes.error) throw exRes.error;
  await series("monthly", "월말 정산", kst("2026-10-31T14:00:00"), kst("2026-10-31T15:00:00"), "FREQ=MONTHLY;UNTIL=20270331T150000Z");
  await series("night", "야간 작업", kst("2026-11-10T23:30:00"), kst("2026-11-11T00:30:00"), "FREQ=DAILY;COUNT=3");
  await series("allday", "금요일 종일", new Date("2026-10-23T00:00:00Z"), new Date("2026-10-23T00:00:00Z"), "FREQ=WEEKLY;COUNT=3", true);
  await series("past", "지난 주간", kst("2026-09-01T09:00:00"), kst("2026-09-01T10:00:00"), "FREQ=WEEKLY;COUNT=4");
  await series("anniv", "결혼기념일", new Date("2024-02-29T00:00:00Z"), new Date("2024-02-29T00:00:00Z"), "FREQ=YEARLY", true, { is_anniversary: true });
  for (let i = 0; i < 60; i++) { try { await fetch(B); break; } catch { await new Promise((r) => setTimeout(r, 2000)); } }
});

after(async () => {
  const all = Object.values(ids);
  for (const id of all) await db.from("event_annotations").delete().eq("user_id", uid).like("event_key", `${id}%`);
  await db.from("event_earnings").delete().eq("user_id", uid).like("event_key", `${ids.past}%`);
  await db.from("event_completions").delete().eq("user_id", uid).like("event_key", `local:${ids.past}%`);
  await db.from("events").delete().in("id", all);
  await db.from("calendars").delete().eq("id", cal);
  const { count } = await db.from("events").select("id", { count: "exact", head: true }).like("title", `${P}%`);
  console.log(`정리: 남은 테스트 일정 ${count}`);
});

const titlesOn = (rows: Array<{ title?: unknown; start_at: string }>) =>
  rows.filter((r) => String(r.title).startsWith(P)).map((r) => `${String(r.title).slice(P.length + 1)}@${new Date(Date.parse(r.start_at) + 9 * 3600e3).toISOString().slice(5, 16)}`).sort();

test("1. calendar-events(앱·웹 캘린더): 회차·예외·월 경계", async () => {
  const oct = await listEventsForUser(uid, 2026, 9);
  assert.deepEqual(titlesOn(oct as never), ["금요일 종일@10-23T09:00", "금요일 종일@10-30T09:00", "월말 정산@10-31T14:00", "주간 회의@10-19T10:00"]);
  const nov = await listEventsForUser(uid, 2026, 10);
  assert.deepEqual(titlesOn(nov as never), ["금요일 종일@11-06T09:00", "야간 작업@11-10T23:30", "야간 작업@11-11T23:30", "야간 작업@11-12T23:30", "주간 회의@11-03T15:00", "주간 회의@11-09T10:00", "주간 회의@11-16T10:00", "주간 회의@11-23T10:00"]);
  const moved = nov.find((e) => e.start_at === iso(kst("2026-11-03T15:00:00")))!;
  assert.equal(moved.id, `${ids.weekly}_20261102T010000Z`);
  const feb27 = await listEventsForUser(uid, 2027, 1);
  assert.deepEqual(titlesOn(feb27 as never), ["결혼기념일@02-28T09:00"]); // 기념일 2/29 → 평년 2/28, 월말 정산 2월 없음
});

test("2. slot-availability(예약 가능 시간): 회차 시간 막힘, 취소한 회차는 다시 열림, 자정 걸침, 종일은 안 막음(기존과 같음)", async () => {
  const spec = { duration_min: 60, slot_interval_min: 30, min_notice_hours: 0, max_advance_days: 60, buffer_min: 0,
    working_hours: { mon: [{ start: "09:00", end: "18:00" }], tue: [{ start: "09:00", end: "23:59" }], wed: [{ start: "00:00", end: "02:00" }], fri: [{ start: "09:00", end: "12:00" }] } };
  const opts = await computeAutoAvailability(uid, spec as never);
  const has = (s: string) => opts.some((o) => o.start_at === iso(kst(s)));
  assert.equal(has("2026-10-19T10:00:00"), false, "10/19 10:00 회차 막힘");
  assert.equal(has("2026-11-09T10:00:00"), false, "11/9 10:00 회차 막힘");
  assert.equal(has("2026-10-26T10:00:00"), true, "10/26 취소한 회차 → 열림");
  assert.equal(has("2026-11-02T10:00:00"), true, "11/2 옮겨 간 회차 → 원래 자리 열림");
  assert.equal(has("2026-11-03T15:00:00"), false, "11/3 15:00 옮겨 온 회차 막힘");
  assert.equal(has("2026-11-10T23:00:00"), false, "11/10 23:00~ 자정 걸친 회차와 겹침");
  assert.equal(has("2026-11-11T00:00:00"), false, "11/11 00:00 자정 넘어 이어지는 부분 막힘");
  assert.equal(has("2026-11-11T01:00:00"), true, "11/11 01:00 회차 끝난 뒤 열림");
  assert.equal(has("2026-10-30T10:00:00"), true, "종일 반복은 예약을 막지 않음(한 번짜리 종일과 같은 규칙)");
  assert.equal(has("2026-11-30T10:00:00"), true, "COUNT 끝난 뒤 월요일 열림");
});

test("3. mutual-availability(서로 빈 시간): 회차 시간은 겹침", async () => {
  const conflicts = await findConflictsForUser(uid, [
    { start_at: iso(kst("2026-11-09T10:00:00")), end_at: iso(kst("2026-11-09T11:00:00")) },
    { start_at: iso(kst("2026-10-26T10:00:00")), end_at: iso(kst("2026-10-26T11:00:00")) },
    { start_at: iso(kst("2026-11-03T15:30:00")), end_at: iso(kst("2026-11-03T16:30:00")) },
  ]);
  assert.deepEqual(conflicts.sort(), [iso(kst("2026-11-03T15:30:00")), iso(kst("2026-11-09T10:00:00"))].sort());
});

test("4. insights(리포트 시간 블록): 회차가 시간으로 잡힘", async () => {
  const blocks = await fetchTimeBlocks(uid, kst("2026-11-09T00:00:00"), kst("2026-11-15T23:59:59"));
  const mine = blocks.filter((b) => String(b.title ?? "").startsWith(P));
  assert.deepEqual(mine.map((b) => String(b.title).slice(P.length + 1)).sort(), ["야간 작업", "야간 작업", "야간 작업", "주간 회의"]);
});

test("5. timeline API(내 지난 완료 일정): 완료한 지난 회차가 보임", async () => {
  const keys = [kst("2026-09-08T09:00:00"), kst("2026-09-15T09:00:00")].map((d) => `local:${occurrenceId(ids.past, d, false)}`);
  for (const k of keys) await db.from("event_completions").upsert({ user_id: uid, event_key: k, status: "done" });
  const r = await fetch(`${B}/api/v1/timeline?months=3`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const mine = ((j.items ?? []) as Array<{ id: string; title?: string; startAt: string }>).filter((i) => String(i.title ?? "").startsWith(P));
  assert.deepEqual(mine.map((i) => i.id).sort(), [occurrenceId(ids.past, kst("2026-09-08T09:00:00"), false), occurrenceId(ids.past, kst("2026-09-15T09:00:00"), false)].sort(), JSON.stringify(j).slice(0, 300));
});

test("6. timeline 웹 페이지(팔로우한 사람의 공개 캘린더, scope=following): 완료한 지난 회차가 보임", async () => {
  // 시드 계정 sora 가 mina 를 팔로우한다(심사 중인 appreview 는 쓰지 않음). 5번에서 넣은 완료 2건을 본다.
  const cookie = `orbit42_session=${await signSession({ username: "sora" })}`;
  const html = await (await fetch(`${B}/sora/timeline?scope=following`, { headers: { cookie } })).text();
  const n = (html.match(/지난 주간/g) ?? []).length;
  assert.ok(n >= 2, `페이지에 '지난 주간' ${n}번`);
});

test("7·8. ProfileCalendarCards·users/[username]/calendars(같은 조회): 일정 있는 날에 회차 날짜", async () => {
  const r = await fetch(`${B}/api/v1/users/mina/calendars?year=2026&month=11`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const c = (j.calendars ?? []).find((x: { id: string }) => x.id === cal);
  assert.ok(c, `공개 캘린더가 응답에 있음: ${JSON.stringify(j).slice(0, 200)}`);
  const days = (c.activeDays ?? []) as number[];
  for (const d of [3, 6, 9, 10, 11, 12, 16, 23]) assert.ok(days.includes(d), `11/${d}: ${days}`);
  assert.ok(!days.includes(2), "11/2(옮겨 감) 없음");
});

test("1b. calendar-events 공유 캘린더 길(나에게 공유된 남의 캘린더): 회차가 보임", async () => {
  const { data: sora } = await db.from("users").select("id").eq("username", "sora").single();
  const ins = await db.from("calendar_members").insert({ calendar_id: cal, user_id: sora!.id, role: "viewer" });
  if (ins.error) throw ins.error;
  try {
    const nov = await listEventsForUser(sora!.id as string, 2026, 10);
    assert.deepEqual(titlesOn(nov as never).filter((t) => t.startsWith("주간 회의")), ["주간 회의@11-03T15:00", "주간 회의@11-09T10:00", "주간 회의@11-16T10:00", "주간 회의@11-23T10:00"]);
  } finally {
    await db.from("calendar_members").delete().eq("calendar_id", cal).eq("user_id", sora!.id);
  }
});

test("9. native-events(공유·공개 캘린더, calendar_id 로 읽는 길): 회차", async () => {
  const rows = await listNativeEventsInCalendars([cal], kst("2026-11-09T00:00:00"), kst("2026-11-12T23:59:59"));
  assert.deepEqual(titlesOn(rows as never), ["야간 작업@11-10T23:30", "야간 작업@11-11T23:30", "야간 작업@11-12T23:30", "주간 회의@11-09T10:00"]);
});

test("10. 별점·다시 알림(event_annotations): 회차 키로 제목·원래 시작을 찾음", async () => {
  const occ = occurrenceId(ids.past, kst("2026-09-08T09:00:00"), false);
  await upsertAnnotation(uid, occ, { rating: 4 });
  const sum = await ratingSummary(uid);
  const item = sum.top.find((t) => t.eventId === occ);
  assert.ok(item && !item.missing && item.title?.endsWith("지난 주간"), JSON.stringify(sum.top));
  assert.equal(item!.startAt, iso(kst("2026-09-08T09:00:00")));
  const occ2 = occurrenceId(ids.weekly, kst("2026-11-16T10:00:00"), false);
  await upsertAnnotation(uid, occ2, { remindAt: iso(kst("2026-11-01T09:00:00")) });
  const rem = await listActiveReminders(uid);
  const r = rem.find((x) => x.eventId === occ2);
  assert.ok(r && !r.missing && r.startAt === iso(kst("2026-11-16T10:00:00")), JSON.stringify(rem));
});

test("11. time-asset(수동 수익): 회차 키도 그 회차 달로 들어감 (오류 없이)", async () => {
  const occ = occurrenceId(ids.past, kst("2026-09-15T09:00:00"), false);
  await db.from("event_earnings").upsert({ user_id: uid, event_key: occ, amount_krw: 12345 });
  const { getTimeAssetSummary } = await import("../src/lib/time-asset");
  const s = await getTimeAssetSummary(uid, "mina");
  const sep = ((s as any).business?.earnTrend ?? []).find((m: { month: string }) => m.month.endsWith("09") || m.month.includes("9월"));
  assert.ok(sep && sep.krw >= 12345, JSON.stringify((s as any).business));
});
