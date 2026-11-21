/** '올해 남은 시간' 연 경계는 한국 시간 — 서버 시간대(TZ)와 무관해야 한다(11/21 버그). */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
import test from "node:test";
import assert from "node:assert/strict";

test("한국 1월 1일 0~9시(UTC 로는 전날)는 새해로 센다", async () => {
  const { yearBoundsKst } = await import("../src/lib/time-asset");
  const b = yearBoundsKst(new Date("2026-12-31T16:00:00Z")); // KST 2027-01-01 01:00
  assert.equal(b.kstYear, 2027);
  assert.equal(b.yearStart.toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(b.yearEnd.toISOString(), "2027-12-31T15:00:00.000Z");
});

test("연말은 한국 12/31 24시(UTC 15시)", async () => {
  const { yearBoundsKst } = await import("../src/lib/time-asset");
  const b = yearBoundsKst(new Date("2026-11-21T00:00:00Z"));
  assert.equal(b.kstYear, 2026);
  assert.equal(b.yearEnd.toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(b.yearStart.toISOString(), "2025-12-31T15:00:00.000Z");
});
