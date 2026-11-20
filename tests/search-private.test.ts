/**
 * 비공개 프로필은 남의 검색(사람·그 사람의 예약 링크)에 안 나온다 — 본인 검색에는 나온다(11/21, iOS /api/v1/search 와 같게).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

import test from "node:test";
import assert from "node:assert/strict";

const users = [
  { id: "u1", username: "open-one", display_name: "공개", avatar_url: null, bio: null, interests: [], is_private: false },
  { id: "u2", username: "hidden-one", display_name: "비공개", avatar_url: null, bio: null, interests: [], is_private: true },
];
const slots = [
  { id: "s1", slug: "a", title: "상담", host_id: "u1", price_cents: 0, pricing_model: "fixed", reserve_price_cents: null, duration_min: 30, active: true },
  { id: "s2", slug: "b", title: "상담", host_id: "u2", price_cents: 0, pricing_model: "fixed", reserve_price_cents: null, duration_min: 30, active: true },
];

async function run(viewer: string | null) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    const body = url.includes("/time_slots") ? slots : users;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const { searchAll } = await import("../src/lib/search");
    return await searchAll("상", viewer);
  } finally {
    globalThis.fetch = real;
  }
}

test("남이 검색하면 비공개 프로필과 그 사람의 예약 링크가 빠진다", async () => {
  for (const viewer of [null, "someone-else"]) {
    const r = await run(viewer);
    assert.deepEqual(r.users.map((u) => u.username), ["open-one"]);
    assert.deepEqual(r.slots.map((s) => s.host.username), ["open-one"]);
  }
});

test("본인이 검색하면 내 비공개 프로필도 나온다", async () => {
  const r = await run("hidden-one");
  assert.deepEqual(r.users.map((u) => u.username).sort(), ["hidden-one", "open-one"]);
  assert.equal(r.slots.length, 2);
});
