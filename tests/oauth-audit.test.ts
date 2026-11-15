import test from "node:test";
import assert from "node:assert/strict";

// supabase 모듈이 불러올 때 주소를 요구한다(이 시험은 네트워크를 쓰지 않음)
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
let emailHash: typeof import("../src/lib/oauth-audit").emailHash;
let oauthAuditOn: typeof import("../src/lib/oauth-audit").oauthAuditOn;
test.before(async () => {
  ({ emailHash, oauthAuditOn } = await import("../src/lib/oauth-audit"));
});

test("이메일 해시: 같은 주소(대소문자·공백 무시)는 같은 값, 원문이 들어 있지 않음, 키가 다르면 다름", () => {
  process.env.AUDIT_HASH_KEY = "k1";
  const a = emailHash("A.B@Example.com ");
  assert.equal(a, emailHash("a.b@example.com"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("example"));
  assert.notEqual(a, emailHash("a_b@example.com"));
  process.env.AUDIT_HASH_KEY = "k2";
  assert.notEqual(a, emailHash("a.b@example.com"));
});

test("감사 기록은 OAUTH_AUDIT=1 일 때만", () => {
  delete process.env.OAUTH_AUDIT;
  assert.equal(oauthAuditOn(), false);
  process.env.OAUTH_AUDIT = "1";
  assert.equal(oauthAuditOn(), true);
});
