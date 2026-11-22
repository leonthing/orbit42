// 프로필 캘린더 카드 달 집계(11/22 버그 1) — KST 달 경계·매달 1일 00~09시·여러 날 종일
import { test } from "node:test";
import assert from "node:assert/strict";
import { eventDaysInMonth, kstMonthRange, kstYearMonth } from "../src/lib/kst";

test("KST 달 범위: 1일 00:00 KST ~ 다음 달 1일 00:00 KST, 12월은 다음 해로", () => {
  const n = kstMonthRange(2026, 11);
  assert.equal(n.from.toISOString(), "2026-10-31T15:00:00.000Z");
  assert.equal(n.to.toISOString(), "2026-11-30T15:00:00.000Z");
  const d = kstMonthRange(2026, 12);
  assert.equal(d.from.toISOString(), "2026-11-30T15:00:00.000Z");
  assert.equal(d.to.toISOString(), "2026-12-31T15:00:00.000Z");
});

test("지금 달: 12/1 00:30 KST(서버 UTC 로는 11/30)는 12월", () => {
  assert.deepEqual(kstYearMonth(new Date("2026-11-30T15:30:00Z")), { year: 2026, month: 12 });
  assert.deepEqual(kstYearMonth(new Date("2026-11-30T14:59:00Z")), { year: 2026, month: 11 });
  assert.deepEqual(kstYearMonth(new Date("2026-12-31T15:00:00Z")), { year: 2027, month: 1 });
});

test("매달 1일 00~09시 KST 시간 일정은 그 달 1일(전엔 앞달로 셌다)", () => {
  const e = { start_at: "2026-11-30T16:00:00Z", end_at: "2026-11-30T17:00:00Z", all_day: false }; // 12/1 01:00 KST
  assert.deepEqual(eventDaysInMonth(e, 2026, 11), []);
  assert.deepEqual(eventDaysInMonth(e, 2026, 12), [1]);
  const late = { start_at: "2026-11-30T14:30:00Z", all_day: false }; // 11/30 23:30 KST
  assert.deepEqual(eventDaysInMonth(late, 2026, 11), [30]);
  assert.deepEqual(eventDaysInMonth(late, 2026, 12), []);
});

test("여러 날 종일은 걸치는 날 모두, 달을 넘으면 각 달에 나눠", () => {
  const g = { start_at: "2026-11-29", end_at: "2026-12-02", all_day: true }; // 구글 날짜만(끝 포함으로 바꾼 뒤)
  assert.deepEqual(eventDaysInMonth(g, 2026, 11), [29, 30]);
  assert.deepEqual(eventDaysInMonth(g, 2026, 12), [1, 2]);
});

test("종일 저장 형식 3가지 모두 같은 날", () => {
  const utcMidnight = { start_at: "2026-12-01T00:00:00Z", end_at: "2026-12-01T00:00:00Z", all_day: true }; // iOS·v1
  const kstDay = { start_at: "2026-11-30T15:00:00Z", end_at: "2026-12-01T14:59:59Z", all_day: true }; // 웹 하루
  const dateOnly = { start_at: "2026-12-01", end_at: "2026-12-01", all_day: true }; // 구글
  for (const e of [utcMidnight, kstDay, dateOnly]) {
    assert.deepEqual(eventDaysInMonth(e, 2026, 12), [1]);
    assert.deepEqual(eventDaysInMonth(e, 2026, 11), []);
  }
});
