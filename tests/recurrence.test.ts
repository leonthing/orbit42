/**
 * 반복 펼치기 단위 테스트 (DB 없이). 실행: npx tsx --test tests/recurrence.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRRule,
  occurrenceStarts,
  computeRecurrenceUntil,
  occurrenceId,
  parseOccurrenceId,
  expandSeries,
  anniversaryDateInYear,
  anniversaryNumber,
} from "../src/lib/recurrence";

const kst = (s: string) => new Date(`${s}+09:00`);
const iso = (d: Date) => d.toISOString();
const far = new Date("2031-01-01T00:00:00Z");

test("규칙 읽기 — 모르는 규칙은 펼치지 않는다", () => {
  assert.deepEqual(parseRRule("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4"), { freq: "WEEKLY", interval: 1, count: 4, byDay: [1, 3] });
  assert.equal(parseRRule("FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR"), null);
  assert.equal(parseRRule("FREQ=HOURLY"), null);
  assert.equal(parseRRule(null), null);
});

test("매주 월 10:00 KST, 6회", () => {
  const s = occurrenceStarts(kst("2026-10-19T10:00:00"), parseRRule("FREQ=WEEKLY;BYDAY=MO;COUNT=6")!, false, far);
  assert.deepEqual(s.map(iso), ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"].map((d) => iso(kst(`${d}T10:00:00`))));
});

test("매주 여러 요일 + 2주마다, 시작 요일보다 앞선 요일은 다음 주기부터", () => {
  // 수요일 시작, 월·수, 2주마다 → 10/21(수), 11/2(월), 11/4(수), 11/16(월)
  const s = occurrenceStarts(kst("2026-10-21T09:00:00"), parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4")!, false, far);
  assert.deepEqual(s.map(iso), ["2026-10-21", "2026-11-02", "2026-11-04", "2026-11-16"].map((d) => iso(kst(`${d}T09:00:00`))));
});

test("매월 31일 — 날짜가 없는 달은 건너뛴다(구글과 같음), UNTIL 포함", () => {
  const s = occurrenceStarts(kst("2026-10-31T14:00:00"), parseRRule("FREQ=MONTHLY;UNTIL=20270331T150000Z")!, false, far);
  assert.deepEqual(s.map(iso), ["2026-10-31", "2026-12-31", "2027-01-31", "2027-03-31"].map((d) => iso(kst(`${d}T14:00:00`))));
});

test("매일, 자정 걸치는 일정 — 원래 시작 기준", () => {
  const s = occurrenceStarts(kst("2026-11-10T23:30:00"), parseRRule("FREQ=DAILY;COUNT=3")!, false, far);
  assert.deepEqual(s.map(iso), ["2026-11-10", "2026-11-11", "2026-11-12"].map((d) => iso(kst(`${d}T23:30:00`))));
});

test("종일 매주 금요일 — 날짜만 본다", () => {
  const s = occurrenceStarts(new Date("2026-10-23T00:00:00Z"), parseRRule("FREQ=WEEKLY;COUNT=3")!, true, far);
  assert.deepEqual(s.map(iso), ["2026-10-23T00:00:00.000Z", "2026-10-30T00:00:00.000Z", "2026-11-06T00:00:00.000Z"]);
});

test("매년 2월 29일 — 일반 반복은 평년 건너뜀, 기념일은 평년 2월 28일", () => {
  const rule = parseRRule("FREQ=YEARLY;COUNT=3")!;
  const plain = occurrenceStarts(new Date("2024-02-29T00:00:00Z"), rule, true, far);
  assert.deepEqual(plain.map((d) => iso(d).slice(0, 10)), ["2024-02-29", "2028-02-29", "2032-02-29"].filter((d) => d < "2031"));
  const anniv = occurrenceStarts(new Date("2024-02-29T00:00:00Z"), rule, true, far, true);
  assert.deepEqual(anniv.map((d) => iso(d).slice(0, 10)), ["2024-02-29", "2025-02-28", "2026-02-28"]);
});

test("recurrence_until — COUNT 는 마지막 회차, 끝없으면 null", () => {
  assert.equal(iso(computeRecurrenceUntil(kst("2026-10-19T10:00:00"), "FREQ=WEEKLY;COUNT=6", false)!), iso(kst("2026-11-23T10:00:00")));
  assert.equal(computeRecurrenceUntil(kst("2026-10-19T10:00:00"), "FREQ=WEEKLY", false), null);
});

test("회차 id — 구글과 같은 꼴, 되읽기", () => {
  const id = occurrenceId("a1c34bad-c4cb-468f-a689-5285fe5b384b", kst("2026-10-20T10:00:00"), false);
  assert.equal(id, "a1c34bad-c4cb-468f-a689-5285fe5b384b_20261020T010000Z");
  assert.equal(occurrenceId("a1c34bad-c4cb-468f-a689-5285fe5b384b", new Date("2026-10-23T00:00:00Z"), true), "a1c34bad-c4cb-468f-a689-5285fe5b384b_20261023");
  const back = parseOccurrenceId(id)!;
  assert.equal(back.seriesId, "a1c34bad-c4cb-468f-a689-5285fe5b384b");
  assert.equal(iso(back.originalStart), iso(kst("2026-10-20T10:00:00")));
  assert.equal(parseOccurrenceId("a1c34bad-c4cb-468f-a689-5285fe5b384b"), null);
});

test("펼치기 — 기간·예외(취소·옮김·제목)", () => {
  const row = { id: "11111111-1111-1111-1111-111111111111", title: "주간 회의", start_at: iso(kst("2026-10-19T10:00:00")), end_at: iso(kst("2026-10-19T11:00:00")), all_day: false, rrule: "FREQ=WEEKLY;COUNT=6" };
  const ex = [
    { event_id: row.id, original_start: iso(kst("2026-10-26T10:00:00")), cancelled: true },
    { event_id: row.id, original_start: iso(kst("2026-11-02T10:00:00")), cancelled: false, start_at: iso(kst("2026-11-03T15:00:00")), end_at: iso(kst("2026-11-03T16:00:00")), title: "옮긴 회의" },
  ];
  const nov = expandSeries(row, ex, kst("2026-11-01T00:00:00"), kst("2026-11-30T23:59:59"));
  assert.deepEqual(nov.map((o) => [o.start_at, o.title]), [
    [iso(kst("2026-11-03T15:00:00")), "옮긴 회의"],
    [iso(kst("2026-11-09T10:00:00")), "주간 회의"],
    [iso(kst("2026-11-16T10:00:00")), "주간 회의"],
    [iso(kst("2026-11-23T10:00:00")), "주간 회의"],
  ]);
  assert.equal(nov[0].id, `${row.id}_20261102T010000Z`); // 옮겨도 원래 시작 기준 id
  assert.equal(nov[1].end_at, iso(kst("2026-11-09T11:00:00")));
  const oct = expandSeries(row, ex, kst("2026-10-01T00:00:00"), kst("2026-10-31T23:59:59"));
  assert.deepEqual(oct.map((o) => o.start_at), [iso(kst("2026-10-19T10:00:00"))]); // 10/26 취소
});

test("기념일 n주년", () => {
  assert.equal(anniversaryDateInYear("2024-02-29", 2027), "2027-02-28");
  assert.equal(anniversaryDateInYear("2024-02-29", 2028), "2028-02-29");
  assert.equal(anniversaryNumber("2020-05-10", "2026-05-10"), 6);
  assert.equal(anniversaryNumber("2024-02-29", "2027-02-28"), 3);
  assert.equal(anniversaryNumber("2020-05-10", "2026-05-11"), null);
  assert.equal(anniversaryNumber("2020-05-10", "2020-05-10"), null);
});
