/**
 * 만족도·할 일·후속 서버 액션은 '나만 봐요' 데이터 — 세션 본인 것만 읽고 쓰는지(PO 11/21).
 * 1) 정적: 액션은 사용자 id 를 인자로 받지 않고, lib 를 부르기 전에 세션(me())에서 id 를 얻는다.
 * 2) 동작: lib(getAnnotations·upsertAnnotation)가 DB 에 보내는 요청이 늘 user_id 로 걸러진다(가짜 fetch).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["src/lib/annotation-actions.ts", "src/lib/todos-actions.ts"]) {
  test(`${file}: 사용자 id 를 인자로 받지 않고 세션에서만 얻는다`, () => {
    const src = readFileSync(file, "utf8");
    assert.ok(src.startsWith('"use server"'), "use server 파일");
    const fns = Array.from(src.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g));
    assert.ok(fns.length >= 2);
    for (const [, name, params, body] of fns) {
      assert.ok(!/user_?id|userId|owner/i.test(params), `${name}: 인자에 사용자 id 가 있으면 안 됨`);
      const meAt = body.search(/await me\(\)|getSession\(\)/);
      assert.ok(meAt >= 0, `${name}: 세션에서 id 를 얻어야 함`);
      const libAt = body.search(/await (createTodos|dayTodos|followUpsOf|linkFollowUp|updateTodo|deleteTodo|getAnnotations|upsertAnnotation)\(/);
      if (libAt >= 0) assert.ok(meAt < libAt, `${name}: lib 를 부르기 전에 세션 확인`);
    }
  });
}

test("만족도 lib: DB 요청이 늘 user_id 로 걸러진다", async () => {
  const seen: { method: string; url: string; body?: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ method: init?.method ?? "GET", url, body: typeof init?.body === "string" ? init.body : undefined });
    const row = { importance: 0, rating: 4, rating_note: null, reminder_minutes: null, remind_at: null, event_key: "e1" };
    const isSingle = String((init?.headers as Record<string, string> | undefined)?.Accept ?? "").includes("vnd.pgrst.object");
    return new Response(JSON.stringify(isSingle ? row : [row]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const { getAnnotations, upsertAnnotation } = await import("../src/lib/event-annotations");
    await getAnnotations("me-uuid", ["e1", "native:e2"]);
    await upsertAnnotation("me-uuid", "e1", { rating: 4 });
  } finally {
    globalThis.fetch = realFetch;
  }
  const reads = seen.filter((r) => r.method === "GET");
  assert.ok(reads.length >= 1);
  for (const r of reads) assert.match(decodeURIComponent(r.url), /user_id=eq\.me-uuid/);
  const writes = seen.filter((r) => r.method === "POST");
  assert.equal(writes.length, 1);
  const body = JSON.parse(writes[0].body ?? "{}");
  assert.equal(body.user_id, "me-uuid");
  assert.deepEqual(Object.keys(body).sort(), ["event_key", "rated_at", "rating", "updated_at", "user_id"]);
});
