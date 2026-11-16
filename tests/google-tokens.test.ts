import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
type M = typeof import("../src/lib/google-tokens");
let m: M;
test.before(async () => {
  m = await import("../src/lib/google-tokens");
});
const KEY1 = randomBytes(32).toString("base64");
const KEY2 = randomBytes(32).toString("base64");
const U = "11111111-1111-1111-1111-111111111111";
const reset = () => {
  delete process.env.GOOGLE_TOKEN_KEY;
  delete process.env.GOOGLE_TOKEN_KEY_V2;
  delete process.env.GOOGLE_TOKEN_KEY_VERSION;
};

test("왕복: 암호문에 원문이 없고, 같은 값도 매번 다르게, 풀면 원문", () => {
  reset();
  process.env.GOOGLE_TOKEN_KEY = KEY1;
  const plain = "1//0gExampleRefreshToken-abc_DEF";
  const a = m.sealToken(plain, "users", "refresh", U);
  const b = m.sealToken(plain, "users", "refresh", U);
  assert.match(a, /^v1:/);
  assert.ok(!a.includes("ExampleRefresh"));
  assert.notEqual(a, b);
  assert.ok(m.isSealed(a));
  assert.equal(m.openToken(a, "users", "refresh", U), plain);
  assert.equal(m.sealToken(a, "users", "refresh", U), a, "이미 암호문이면 두 번 싸지 않음");
});

test("변조 거부: 암호문·태그 한 글자, 다른 사람·다른 칸·다른 표, 다른 키", () => {
  reset();
  process.env.GOOGLE_TOKEN_KEY = KEY1;
  const s = m.sealToken("ya29.access", "card_google_tokens", "access", U);
  const [ver, rest] = [s.slice(0, 3), s.slice(3)];
  const [iv, tag, ct] = rest.split(".");
  const flip = (x: string) => (x[0] === "A" ? "B" : "A") + x.slice(1);
  for (const bad of [`${ver}${iv}.${tag}.${flip(ct)}`, `${ver}${iv}.${flip(tag)}.${ct}`, `${ver}${flip(iv)}.${tag}.${ct}`]) {
    assert.throws(() => m.openToken(bad, "card_google_tokens", "access", U), m.GoogleTokenDecryptError);
  }
  assert.throws(() => m.openToken(s, "card_google_tokens", "access", "22222222-2222-2222-2222-222222222222"), m.GoogleTokenDecryptError);
  assert.throws(() => m.openToken(s, "card_google_tokens", "refresh", U), m.GoogleTokenDecryptError);
  assert.throws(() => m.openToken(s, "google_accounts", "access", U), m.GoogleTokenDecryptError);
  process.env.GOOGLE_TOKEN_KEY = KEY2;
  assert.throws(() => m.openToken(s, "card_google_tokens", "access", U), m.GoogleTokenDecryptError);
  delete process.env.GOOGLE_TOKEN_KEY;
  assert.throws(() => m.openToken(s, "card_google_tokens", "access", U), m.GoogleTokenDecryptError, "키 없으면 풀지 않음");
});

test("평문 행 읽기: 키가 있어도 없어도 예전 평문은 그대로", () => {
  reset();
  for (const v of ["1//0gPlainRefresh", "ya29.a0Plain-Access_token.x"]) {
    assert.equal(m.isSealed(v), false);
    assert.equal(m.openToken(v, "users", "refresh", U), v);
    process.env.GOOGLE_TOKEN_KEY = KEY1;
    assert.equal(m.openToken(v, "users", "refresh", U), v);
    delete process.env.GOOGLE_TOKEN_KEY;
  }
});

test("키 없으면 쓰기는 평문(전환기), 키가 32바이트 아니면 거절", () => {
  reset();
  assert.equal(m.googleTokenEncryptionOn(), false);
  assert.equal(m.sealToken("1//x", "users", "refresh", U), "1//x");
  process.env.GOOGLE_TOKEN_KEY = Buffer.from("short").toString("base64");
  assert.throws(() => m.sealToken("1//x", "users", "refresh", U), /32바이트/);
});

test("키 바꾸기: v2 로 쓰고 옛 v1 도 풀림", () => {
  reset();
  process.env.GOOGLE_TOKEN_KEY = KEY1;
  const old = m.sealToken("1//old", "google_accounts", "refresh", U);
  process.env.GOOGLE_TOKEN_KEY_V2 = KEY2;
  process.env.GOOGLE_TOKEN_KEY_VERSION = "v2";
  const neu = m.sealToken("1//new", "google_accounts", "refresh", U);
  assert.match(neu, /^v2:/);
  assert.equal(m.openToken(old, "google_accounts", "refresh", U), "1//old");
  assert.equal(m.openToken(neu, "google_accounts", "refresh", U), "1//new");
  reset();
});

test("짧은 태그 거부: 앞 4·8·12바이트만 남긴 태그, 빈 태그, iv 길이 다름", () => {
  reset();
  process.env.GOOGLE_TOKEN_KEY = KEY1;
  const s = m.sealToken("1//refresh", "users", "refresh", U);
  const [iv, tag, ct] = s.slice(3).split(".");
  const tagBuf = Buffer.from(tag, "base64url");
  assert.equal(tagBuf.length, 16);
  for (const n of [4, 8, 12, 0]) {
    const short = `v1:${iv}.${tagBuf.subarray(0, n).toString("base64url")}.${ct}`;
    assert.throws(() => m.openToken(short, "users", "refresh", U), m.GoogleTokenDecryptError, `태그 ${n}바이트`);
  }
  const iv16 = Buffer.concat([Buffer.from(iv, "base64url"), Buffer.alloc(4)]).toString("base64url");
  assert.throws(() => m.openToken(`v1:${iv16}.${tag}.${ct}`, "users", "refresh", U), m.GoogleTokenDecryptError);
  assert.equal(m.openToken(s, "users", "refresh", U), "1//refresh");
  reset();
});
