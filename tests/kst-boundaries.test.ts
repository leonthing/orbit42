/** 날짜 경계는 한국 시간 — 서버 시간대(TZ)와 무관(11/21 PO). TZ=UTC·Asia/Seoul·America/Los_Angeles 로 돌린다. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kstMonthKey, kstMonthStart, kstStartOfWeek, kstYearStart, addDays } from "../src/lib/kst";

test("달 키: 한국 12/1 03시(UTC 11/30 18시)는 12월", () => {
  assert.equal(kstMonthKey(new Date("2026-11-30T18:00:00Z")), "2026-12");
  assert.equal(kstMonthKey(new Date("2026-11-30T14:59:00Z")), "2026-11");
});

test("달 시작: KST 1일 0시 = UTC 전날 15시, 13월은 다음 해 1월", () => {
  assert.equal(kstMonthStart(2026, 10).toISOString(), "2026-10-31T15:00:00.000Z");
  assert.equal(kstMonthStart(2026, 12).toISOString(), "2026-12-31T15:00:00.000Z");
});

test("연 시작: 한국 1/1 02시(UTC 12/31 17시)는 새해", () => {
  assert.equal(kstYearStart(new Date("2026-12-31T17:00:00Z")).toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(kstYearStart(new Date("2026-11-21T00:00:00Z")).toISOString(), "2025-12-31T15:00:00.000Z");
});

test("주 시작: 한국 월요일 05시(UTC 일요일 20시)는 그 월요일 0시부터", () => {
  // 2026-11-23 은 월요일
  const mon5 = new Date("2026-11-22T20:00:00Z");
  assert.equal(kstStartOfWeek(mon5, "mon").toISOString(), "2026-11-22T15:00:00.000Z");
  assert.equal(kstStartOfWeek(mon5, "sun").toISOString(), "2026-11-21T15:00:00.000Z");
  assert.equal(addDays(kstStartOfWeek(mon5), 6).toISOString(), "2026-11-28T15:00:00.000Z");
});

test("세 곳이 KST 도우미를 쓴다(서버 지역 시간 경계 금지)", () => {
  const ta = readFileSync("src/lib/time-asset.ts", "utf8");
  assert.match(ta, /kstMonthStartOf\(fy, fm - 1\)/);
  assert.match(ta, /const key = kstMonthKey\(b\.start\);/);
  assert.match(readFileSync("src/lib/calendar-goals.ts", "utf8"), /: kstYearStart\(now\)/);
  const pw = readFileSync("src/lib/profile-week.ts", "utf8");
  assert.match(pw, /return kstStartOfWeek\(d, ws\);/);
  assert.doesNotMatch(pw, /setHours\(0, 0, 0, 0\)/);
});
