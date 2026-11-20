import { test } from "node:test";
import assert from "node:assert/strict";
import { googleErrorSummary, isDateOnly } from "../src/lib/google-error";

test("isDateOnly: 날짜만 있는 값만 참", () => {
  assert.equal(isDateOnly("2026-11-23"), true);
  assert.equal(isDateOnly("2026-11-23T10:00:00+09:00"), false);
  assert.equal(isDateOnly(""), false);
  assert.equal(isDateOnly(undefined), false);
});

test("googleErrorSummary: 상태·사유만 남기고 요청 본문은 남기지 않음", () => {
  const err = {
    message: "Bad Request",
    config: { body: '{"summary":"비밀 회의","description":"메모"}' },
    response: { status: 400, data: { error: { message: "Bad Request", errors: [{ reason: "invalid", message: "Invalid start time." }] } } },
  };
  const s = googleErrorSummary(err);
  assert.equal(s, "status=400 invalid: Invalid start time.");
  assert.ok(!s.includes("비밀"));
  assert.equal(googleErrorSummary(new Error("boom")), "status=? boom");
});
