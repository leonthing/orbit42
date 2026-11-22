/** 구글 수정: 종일↔시간 전환 null 칸은 실제로 바뀔 때만(11/22 PO) */
import test from "node:test";
import assert from "node:assert/strict";
import { onlySwitchNulls } from "../src/lib/google-switch";

const allDayItem = { start: { date: "2026-11-18" }, end: { date: "2026-11-21" } };
const timedItem = { start: { dateTime: "2026-11-18T10:00:00+09:00" }, end: { dateTime: "2026-11-18T11:00:00+09:00" } };

test("종일 → 종일(날짜만 바꿈): null 칸을 뺀다", () => {
  const b = onlySwitchNulls({ start: { date: "2026-11-15", dateTime: null, timeZone: null }, end: { date: "2026-11-18", dateTime: null, timeZone: null } }, allDayItem);
  assert.deepEqual(b, { start: { date: "2026-11-15" }, end: { date: "2026-11-18" } });
});
test("시간 → 종일(전환): null 칸을 남긴다", () => {
  const body = { start: { date: "2026-11-18", dateTime: null, timeZone: null }, end: { date: "2026-11-19", dateTime: null, timeZone: null } };
  assert.deepEqual(onlySwitchNulls(structuredClone(body), timedItem), body);
});
test("종일 → 시간(전환): date null 을 남긴다", () => {
  const body = { start: { dateTime: "2026-11-18T09:00:00+09:00", timeZone: "Asia/Seoul", date: null }, end: { dateTime: "2026-11-18T10:00:00+09:00", timeZone: "Asia/Seoul", date: null } };
  assert.deepEqual(onlySwitchNulls(structuredClone(body), allDayItem), body);
});
test("시간 → 시간: date null 을 뺀다", () => {
  const b = onlySwitchNulls({ start: { dateTime: "2026-11-18T09:00:00+09:00", timeZone: "Asia/Seoul", date: null } }, timedItem);
  assert.deepEqual(b, { start: { dateTime: "2026-11-18T09:00:00+09:00", timeZone: "Asia/Seoul" } });
});
test("지금 일정을 못 읽었으면 바디 그대로", () => {
  const body = { start: { date: "2026-11-15", dateTime: null, timeZone: null } };
  assert.deepEqual(onlySwitchNulls(structuredClone(body), null), body);
});
test("제목만 바꿀 때(start/end 없음)는 건드리지 않음", () => {
  assert.deepEqual(onlySwitchNulls({ summary: "x" }, allDayItem), { summary: "x" });
});
