/** 여러 날 종일 일정이 걸치는 KST 날짜(11/22 PO) — 저장 형식 셋 × 하루/3일, 달·해 넘김. TZ 와 무관해야 한다. */
import test from "node:test";
import assert from "node:assert/strict";
import { allDayKstDates, eventOnKstDate } from "../src/lib/kst";

test("날짜만·끝 포함(iOS 저장분, DB 에는 UTC 0시): 하루", () => {
  assert.deepEqual(allDayKstDates("2026-11-16T00:00:00+00:00", "2026-11-16T00:00:00+00:00"), ["2026-11-16"]);
});
test("날짜만·끝 포함: 3일", () => {
  assert.deepEqual(allDayKstDates("2026-11-24T00:00:00+00:00", "2026-11-26T00:00:00+00:00"), ["2026-11-24", "2026-11-25", "2026-11-26"]);
});
test("KST 자정·끝 제외(다음 날 0시): 하루", () => {
  assert.deepEqual(allDayKstDates("2026-11-19T00:00:00+09:00", "2026-11-20T00:00:00+09:00"), ["2026-11-19"]);
});
test("KST 자정·끝 제외: 3일", () => {
  assert.deepEqual(allDayKstDates("2026-11-18T00:00:00+09:00", "2026-11-21T00:00:00+09:00"), ["2026-11-18", "2026-11-19", "2026-11-20"]);
});
test("웹 하루 종일(KST 0시 ~ 23:59:59): 하루", () => {
  assert.deepEqual(allDayKstDates("2026-11-25T00:00:00+09:00", "2026-11-25T23:59:59+09:00"), ["2026-11-25"]);
  assert.deepEqual(allDayKstDates(new Date("2026-11-25T00:00:00+09:00").toISOString(), new Date("2026-11-25T23:59:59+09:00").toISOString()), ["2026-11-25"]);
});
test("구글 날짜 문자열(끝은 이미 포함으로 바꿔 둔 값)", () => {
  assert.deepEqual(allDayKstDates("2026-11-24", "2026-11-26"), ["2026-11-24", "2026-11-25", "2026-11-26"]);
  assert.deepEqual(allDayKstDates("2026-11-24", "2026-11-24"), ["2026-11-24"]);
});
test("달 넘김(11/30~12/2) 두 형식", () => {
  const want = ["2026-11-30", "2026-12-01", "2026-12-02"];
  assert.deepEqual(allDayKstDates("2026-11-30T00:00:00+00:00", "2026-12-02T00:00:00+00:00"), want);
  assert.deepEqual(allDayKstDates("2026-11-30T00:00:00+09:00", "2026-12-03T00:00:00+09:00"), want);
});
test("해 넘김(12/31~1/1) 두 형식", () => {
  const want = ["2026-12-31", "2027-01-01"];
  assert.deepEqual(allDayKstDates("2026-12-31T00:00:00+00:00", "2027-01-01T00:00:00+00:00"), want);
  assert.deepEqual(allDayKstDates("2026-12-31T00:00:00+09:00", "2027-01-02T00:00:00+09:00"), want);
});
test("끝이 없거나 시작보다 앞이면 시작 하루, 너무 길면 366일에서 자름", () => {
  assert.deepEqual(allDayKstDates("2026-11-24T00:00:00+00:00", null), ["2026-11-24"]);
  assert.deepEqual(allDayKstDates("2026-11-24T00:00:00+00:00", "2026-11-20T00:00:00+00:00"), ["2026-11-24"]);
  assert.equal(allDayKstDates("2026-01-01", "2030-01-01").length, 366);
});
test("eventOnKstDate: 종일은 걸친 날 모두, 시간 일정은 시작한 날(KST)", () => {
  const ad = { start_at: "2026-11-24T00:00:00+00:00", end_at: "2026-11-26T00:00:00+00:00", all_day: true };
  assert.equal(eventOnKstDate(ad, "2026-11-25"), true);
  assert.equal(eventOnKstDate(ad, "2026-11-27"), false);
  const timed = { start_at: "2026-11-24T23:30:00+09:00", end_at: "2026-11-25T01:00:00+09:00", all_day: false };
  assert.equal(eventOnKstDate(timed, "2026-11-24"), true);
  assert.equal(eventOnKstDate(timed, "2026-11-25"), false);
});
