/**
 * 서버 로그에 오류 객체를 통째로 남기지 않기(PO 11/21) — 요청 본문·DB details(값)가 함께 찍힌다.
 * console.error/warn 의 인자에 err·error·e·xxxErr·xxxError 같은 오류 변수가 그대로 들어가면 실패.
 * 고치는 법: errorSummary(err)(lib/log-safe) 또는 googleErrorSummary(err)(구글 API).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { errorSummary } from "../src/lib/log-safe";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const RAW = /^(err|error|e|ex|caught|reason|[a-z]\w*Err|[a-z]\w*Error)$/;

test("console.error/warn 에 오류 객체를 통째로 넘기는 곳이 0", () => {
  const bad: string[] = [];
  const call = /console\.(error|warn)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g;
  for (const f of walk("src")) {
    const s = readFileSync(f, "utf8");
    for (const m of Array.from(s.matchAll(call))) {
      const args = m[2].split(",").map((a) => a.trim());
      if (args.some((a) => RAW.test(a))) bad.push(`${f}:${s.slice(0, m.index).split("\n").length}  ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [], `오류 객체 통째 로그:\n${bad.join("\n")}`);
});

test("errorSummary: DB 오류는 code·message·hint 만, details(값)는 빼고", () => {
  const pg = { code: "23505", message: 'duplicate key value violates unique constraint "users_email_key"', details: "Key (email)=(a@b.c) already exists.", hint: null };
  const s = errorSummary(pg);
  assert.equal(s, 'status=23505 duplicate key value violates unique constraint "users_email_key"');
  assert.ok(!s.includes("a@b.c"));
  assert.equal(errorSummary({ code: "42501", message: "permission denied", hint: "grant select" }), "status=42501 permission denied (hint: grant select)");
});
