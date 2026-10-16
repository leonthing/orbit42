/** 메일을 받을 수 없는 주소(개선-18). 실행: npx tsx --test tests/email-deliverable.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canReceiveEmail } from "../src/lib/email-deliverable";

test("orbit42.org(데모 계정)·빈 값은 못 받음, 일반 주소는 받음", () => {
  assert.equal(canReceiveEmail("appreview@orbit42.org"), false);
  assert.equal(canReceiveEmail(" AppReview@Orbit42.org "), false);
  assert.equal(canReceiveEmail(null), false);
  assert.equal(canReceiveEmail(""), false);
  assert.equal(canReceiveEmail("someone@gmail.com"), true);
  assert.equal(canReceiveEmail("leo@nthing.net"), true);
  assert.equal(canReceiveEmail("a@sub.orbit42.org.example.com"), true);
});
