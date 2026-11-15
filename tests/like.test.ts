import test from "node:test";
import assert from "node:assert/strict";
import { escapeLike, likeContains, likeExact, pgrstQuote } from "../src/lib/like";

test("LIKE 와일드카드는 글자 그대로", () => {
  assert.equal(escapeLike("a_b%c\\d"), "a\\_b\\%c\\\\d");
  assert.equal(likeExact("first_last@x.com"), "first\\_last@x.com");
  assert.equal(likeContains("harin.design"), "%harin.design%");
  assert.equal(escapeLike("a*b"), "ab");
});

test("PostgREST or() 값은 큰따옴표로 — 문법 글자 끼워 넣기 막기", () => {
  assert.equal(pgrstQuote("%harin.design%"), '"%harin.design%"');
  assert.equal(pgrstQuote('%x",id.eq.1%'), '"%x\\",id.eq.1%"');
  assert.equal(pgrstQuote("%a\\_b%"), '"%a\\\\_b%"');
});
