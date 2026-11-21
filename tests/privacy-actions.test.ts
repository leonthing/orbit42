/**
 * 프로필 비공개·차단 목록(11/21 묶음 다) — 세션 본인 것만, 허용 칸(is_private)만.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("privacy-actions: use server, 사용자 id 를 인자로 받지 않고 세션에서, is_private 한 칸만 쓴다", () => {
  const src = readFileSync("src/app/[username]/settings/privacy-actions.ts", "utf8");
  assert.ok(src.startsWith('"use server"'));
  const fns = Array.from(src.matchAll(/export async function (\w+)\(([^)]*)\)/g));
  assert.deepEqual(fns.map((f) => f[1]), ["setProfilePrivate"], "내보내는 액션은 하나");
  assert.ok(!/user_?id|userId|username|owner/i.test(fns[0][2]), "인자에 사용자 식별자 없음");
  assert.match(src, /requireUserId\(\)/);
  assert.match(src, /\.eq\("id", userId\)/);
  const update = src.match(/\.update\(\{([^}]*)\}\)/)?.[1] ?? "";
  const keys = update.split(",").map((s) => s.split(":")[0].trim()).filter(Boolean).sort();
  assert.deepEqual(keys, ["is_private", "updated_at"]);
  assert.match(src, /typeof isPrivate !== "boolean"/, "불리언만 받음");
});

test("listBlockedUsers: 내가 차단한 줄만 읽는다(blocker_id = 나)", async () => {
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(decodeURIComponent(String(input)));
    return new Response(JSON.stringify([{ blocked: { username: "x", display_name: null } }]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const { listBlockedUsers } = await import("../src/lib/blocks");
    const r = await listBlockedUsers("me-uuid");
    assert.deepEqual(r, [{ username: "x", displayName: null }]);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(seen.length, 1);
  assert.match(seen[0], /user_blocks/);
  assert.match(seen[0], /blocker_id=eq\.me-uuid/);
});
