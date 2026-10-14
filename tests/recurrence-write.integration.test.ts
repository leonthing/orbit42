/**
 * 반복 일정 쓰기(1.5.1 2단계) — 앱 API 로 만들고·회차만/이후 모두/모두 고치고 지우기 (운영 DB, 데모 계정 mina, 끝나면 모두 지움).
 * 실행: (로컬 서버 켠 채로) npx tsx --env-file=.env.local --tsconfig tsconfig.json --test tests/recurrence-write.integration.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { getAdminClient } from "../src/lib/supabase";
import { signSession } from "../src/lib/session";
import { computeAutoAvailability } from "../src/lib/slot-availability";
import { upsertAnnotation, getAnnotations } from "../src/lib/event-annotations";

const B = "http://localhost:3000";
const kst = (s: string) => new Date(`${s}+09:00`);
const iso = (d: Date) => d.toISOString();
const P = "[테스트반복쓰기]";
const db = getAdminClient();
let uid = "";
let cal = "";
let other = "";
let token = "";

type ApiEvent = { id: string; title: string; startAt: string; endAt: string; isRecurring: boolean; seriesId: string | null; isAnniversary: boolean; anniversaryYears: number | null };

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${B}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function list(from: string, to: string): Promise<ApiEvent[]> {
  const { json } = await api("GET", `/api/v1/calendar/events?from=${from}&to=${to}`);
  return ((json.events ?? []) as ApiEvent[]).filter((e) => e.title.startsWith(P));
}
const show = (es: ApiEvent[]) =>
  es.map((e) => `${e.title.slice(P.length + 1)}@${new Date(Date.parse(e.startAt) + 9 * 3600e3).toISOString().slice(5, 16)}`).sort();

async function create(title: string, start: string, end: string, rrule: string, extra: Record<string, unknown> = {}) {
  const { status, json } = await api("POST", "/api/v1/calendar/events", {
    title: `${P} ${title}`, startAt: start, endAt: end, allDay: false, calendarId: cal, rrule, ...extra,
  });
  assert.equal(status, 200, JSON.stringify(json));
  return json.event as ApiEvent;
}

before(async () => {
  const { data: u } = await db.from("users").select("id").eq("username", "mina").single();
  uid = u!.id as string;
  const { data: c } = await db.from("calendars").insert({ user_id: uid, name: `${P} 캘린더`, source: "native", visibility: "private", color: "#10b981", purpose: "personal" }).select("id").single();
  cal = c!.id as string;
  const { data: c2 } = await db.from("calendars").insert({ user_id: uid, name: `${P} 다른`, source: "native", visibility: "private", color: "#f59e0b", purpose: "personal" }).select("id").single();
  other = c2!.id as string;
  token = await signSession({ username: "mina" });
  for (let i = 0; i < 60; i++) { try { await fetch(B); break; } catch { await new Promise((r) => setTimeout(r, 2000)); } }
});

after(async () => {
  const { data: rows } = await db.from("events").select("id").eq("user_id", uid).like("title", `${P}%`);
  for (const r of rows ?? []) {
    await db.from("event_annotations").delete().eq("user_id", uid).like("event_key", `${r.id}%`);
    await db.from("event_completions").delete().eq("user_id", uid).like("event_key", `local:${r.id}%`);
  }
  await db.from("events").delete().eq("user_id", uid).like("title", `${P}%`);
  await db.from("calendars").delete().in("id", [cal, other]);
  const { count } = await db.from("events").select("id", { count: "exact", head: true }).like("title", `${P}%`);
  console.log(`정리: 남은 테스트 일정 ${count}`);
});

test("1. 만들기: 매주 월·수 6회 → 회차 6개, 반복 표시", async () => {
  const ev = await create("주간", iso(kst("2026-11-02T10:00:00")), iso(kst("2026-11-02T11:00:00")), "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6");
  const es = await list("2026-11-01", "2026-11-30");
  assert.deepEqual(show(es), ["주간@11-02T10:00", "주간@11-04T10:00", "주간@11-09T10:00", "주간@11-11T10:00", "주간@11-16T10:00", "주간@11-18T10:00"]);
  assert.ok(es.every((e) => e.isRecurring && e.seriesId === ev.id));
  const bad = await api("POST", "/api/v1/calendar/events", { title: `${P} 이상`, startAt: iso(kst("2026-11-02T10:00:00")), endAt: iso(kst("2026-11-02T11:00:00")), calendarId: cal, rrule: "FREQ=HOURLY" });
  assert.equal(bad.status, 400);
});

test("2. 이 일정만: 범위 없이 보낸 시간 변경(1.5.0 앱 끌기)도 그 회차만, 지우기도 그 회차만", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const wed = es.find((e) => e.startAt === iso(kst("2026-11-04T10:00:00")))!;
  const r = await api("PATCH", `/api/v1/calendar/events/${wed.id}`, { startAt: iso(kst("2026-11-04T15:00:00")), endAt: iso(kst("2026-11-04T16:00:00")) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const mon = es.find((e) => e.startAt === iso(kst("2026-11-09T10:00:00")))!;
  const d = await api("DELETE", `/api/v1/calendar/events/${mon.id}?scope=this`);
  assert.equal(d.status, 200);
  const after = await list("2026-11-01", "2026-11-30");
  assert.deepEqual(show(after), ["주간@11-02T10:00", "주간@11-04T15:00", "주간@11-11T10:00", "주간@11-16T10:00", "주간@11-18T10:00"]);
  assert.equal(after.find((e) => e.startAt === iso(kst("2026-11-04T15:00:00")))!.id, wed.id, "옮겨도 회차 id 는 그대로");
});

test("3. 모두: 제목 + 한 시간 뒤로 → 전 회차 이동, 회차 기록(별점)도 따라감", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const occ16 = es.find((e) => e.startAt === iso(kst("2026-11-16T10:00:00")))!;
  await upsertAnnotation(uid, occ16.id, { rating: 4 });
  const occ11 = es.find((e) => e.startAt === iso(kst("2026-11-11T10:00:00")))!;
  const r = await api("PATCH", `/api/v1/calendar/events/${occ11.id}`, { scope: "all", title: `${P} 주간B`, startAt: iso(kst("2026-11-11T11:00:00")), endAt: iso(kst("2026-11-11T12:00:00")) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = await list("2026-11-01", "2026-11-30");
  // 11/4 은 이 회차만 15:00 로 옮겨 둔 것이라 그대로, 11/9 는 지운 그대로
  assert.deepEqual(show(after), ["주간B@11-02T11:00", "주간B@11-04T15:00", "주간B@11-11T11:00", "주간B@11-16T11:00", "주간B@11-18T11:00"]);
  const moved16 = after.find((e) => e.startAt === iso(kst("2026-11-16T11:00:00")))!;
  const ann = await getAnnotations(uid, [moved16.id]);
  assert.equal(Array.from(ann.values())[0]?.rating, 4, "별점이 밀린 회차로 따라감");
});

test("4. 이후 모두: 11/16 부터 제목 바꾸면 앞은 그대로·뒤는 새 시리즈, 기록 따라감, 회차 수 유지", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const occ16 = es.find((e) => e.startAt === iso(kst("2026-11-16T11:00:00")))!;
  const oldSeries = occ16.seriesId!;
  const r = await api("PATCH", `/api/v1/calendar/events/${occ16.id}`, { scope: "following", title: `${P} 주간C` });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = await list("2026-11-01", "2026-11-30");
  assert.deepEqual(show(after), ["주간B@11-02T11:00", "주간B@11-04T15:00", "주간B@11-11T11:00", "주간C@11-16T11:00", "주간C@11-18T11:00"]);
  const c16 = after.find((e) => e.title.endsWith("주간C") && e.startAt === iso(kst("2026-11-16T11:00:00")))!;
  assert.notEqual(c16.seriesId, oldSeries);
  const ann = await getAnnotations(uid, [c16.id]);
  assert.equal(Array.from(ann.values())[0]?.rating, 4, "별점이 새 시리즈 회차로 따라감");
  // COUNT=6 의 남은 몫 → 새 시리즈는 11/16·11/18 두 번(전체 6회 유지: 지운 회차 포함)
  const dec = await list("2026-12-01", "2026-12-31");
  assert.deepEqual(show(dec), []);
});

test("5. 이후 모두 지우기 / 모두 지우기", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const b04 = es.find((e) => e.title.endsWith("주간B") && e.startAt === iso(kst("2026-11-04T15:00:00")))!;
  const d1 = await api("DELETE", `/api/v1/calendar/events/${b04.id}?scope=following`);
  assert.equal(d1.status, 200);
  assert.deepEqual(show(await list("2026-11-01", "2026-11-30")), ["주간B@11-02T11:00", "주간C@11-16T11:00", "주간C@11-18T11:00"]);
  const c18 = (await list("2026-11-01", "2026-11-30")).find((e) => e.startAt === iso(kst("2026-11-18T11:00:00")))!;
  const d2 = await api("DELETE", `/api/v1/calendar/events/${c18.id}?scope=all`);
  assert.equal(d2.status, 200);
  assert.deepEqual(show(await list("2026-11-01", "2026-11-30")), ["주간B@11-02T11:00"]);
});

test("6. 반복은 다른 캘린더로 못 옮김 / 이 회차만 반복 규칙 바꾸기는 거절", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const one = es[0];
  const mv = await api("PATCH", `/api/v1/calendar/events/${one.id}`, { calendarId: other });
  assert.equal(mv.status, 400);
  assert.match(mv.json.error, /반복 일정은 다른 캘린더로/);
  const rr = await api("PATCH", `/api/v1/calendar/events/${one.id}`, { scope: "this", rrule: "FREQ=DAILY;COUNT=2" });
  assert.equal(rr.status, 400);
});

test("7. 모두: 반복 규칙 바꾸기(매일 3회) / 반복 끄기, 시리즈 정보 읽기", async () => {
  const es = await list("2026-11-01", "2026-11-30");
  const one = es[0];
  const info0 = await api("GET", `/api/v1/calendar/events/${one.id}/series`);
  assert.match(info0.json.rrule, /^FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=\d{8}T\d{6}Z$/, "이후 모두 지우기로 UNTIL 로 잘림");
  const r = await api("PATCH", `/api/v1/calendar/events/${one.id}`, { scope: "all", rrule: "FREQ=DAILY;COUNT=3" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(show(await list("2026-11-01", "2026-11-30")), ["주간B@11-02T11:00", "주간B@11-03T11:00", "주간B@11-04T11:00"]);
  const off = await api("PATCH", `/api/v1/calendar/events/${one.id}`, { scope: "all", rrule: null });
  assert.equal(off.status, 200, JSON.stringify(off.json));
  const single = await list("2026-11-01", "2026-11-30");
  assert.deepEqual(show(single), ["주간B@11-02T11:00"]);
  assert.equal(single[0].isRecurring, false);
});

test("8. 기념일: 2024-02-29 매년 → 2027-02-28 에 3주년, 2028-02-29 에 4주년", async () => {
  const { status, json } = await api("POST", "/api/v1/calendar/events", {
    title: `${P} 기념일`, startAt: "2024-02-29", endAt: "2024-02-29", allDay: true, calendarId: cal, rrule: "FREQ=YEARLY", isAnniversary: true,
  });
  assert.equal(status, 200, JSON.stringify(json));
  const y27 = await list("2027-02-01", "2027-03-05");
  assert.equal(y27.length, 1);
  assert.equal(y27[0].isAnniversary, true);
  assert.equal(y27[0].anniversaryYears, 3);
  assert.equal(y27[0].startAt.slice(0, 10), "2027-02-28");
  const y28 = await list("2028-02-01", "2028-03-05");
  assert.equal(y28[0].anniversaryYears, 4);
  assert.equal(y28[0].startAt.slice(0, 10), "2028-02-29");
});

test("9. 예약 가능 시간: 앱으로 만든 반복 회차가 막음", async () => {
  await create("예약막기", iso(kst("2026-11-24T14:00:00")), iso(kst("2026-11-24T15:00:00")), "FREQ=WEEKLY;COUNT=3");
  const spec = { duration_min: 60, slot_interval_min: 60, min_notice_hours: 0, max_advance_days: 60, buffer_min: 0,
    working_hours: { tue: [{ start: "13:00", end: "17:00" }] } };
  const opts = await computeAutoAvailability(uid, spec as never);
  const has = (s: string) => opts.some((o) => o.start_at === iso(kst(s)));
  assert.equal(has("2026-11-24T14:00:00"), false, "1회차 막힘");
  assert.equal(has("2026-12-01T14:00:00"), false, "2회차 막힘");
  assert.equal(has("2026-12-01T15:00:00"), true, "바로 뒤는 열림");
});

test("10. 이 일정만: 장소·좌표·이동시간 저장 / 이동시간 없음(0) / 장소 지우기 — 시리즈 값은 그대로", async () => {
  const ev = await create("장소", iso(kst("2026-12-01T10:00:00")), iso(kst("2026-12-01T11:00:00")), "FREQ=DAILY;COUNT=3", {
    location: "시리즈 장소", locationLat: 37.5, locationLng: 127.0, travelMin: 20,
  });
  type L = ApiEvent & { location: string | null; locationLat: number | null; locationLng: number | null; travelMin: number | null };
  const day = async (d: string) => ((await list("2026-12-01", "2026-12-04")) as L[]).find((e) => e.title.endsWith("장소") && e.startAt === iso(kst(`2026-12-0${d}T10:00:00`)))!;
  const o2 = await day("2");
  const r1 = await api("PATCH", `/api/v1/calendar/events/${o2.id}`, { scope: "this", location: "회차 장소", locationLat: 35.1, locationLng: 129.0, travelMin: 45 });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  let a = await day("2");
  assert.deepEqual([a.location, a.locationLat, a.locationLng, a.travelMin], ["회차 장소", 35.1, 129.0, 45]);
  const r2 = await api("PATCH", `/api/v1/calendar/events/${o2.id}`, { scope: "this", travelMin: 0 });
  assert.equal(r2.status, 200);
  a = await day("2");
  assert.equal(a.travelMin, null, "이 회차만 이동시간 없음");
  const o3 = await day("3");
  const r3 = await api("PATCH", `/api/v1/calendar/events/${o3.id}`, { scope: "this", location: "" });
  assert.equal(r3.status, 200);
  const b = await day("3");
  assert.deepEqual([b.location || null, b.locationLat, b.locationLng], [null, null, null], "이 회차만 장소 지움");
  const c = await day("1");
  assert.deepEqual([c.location, c.locationLat, c.travelMin], ["시리즈 장소", 37.5, 20], "다른 회차는 시리즈 값");
  void ev;
});
