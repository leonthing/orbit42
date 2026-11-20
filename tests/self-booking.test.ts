/** 자기 예약 링크 예약 막기(PO 11/21) — bookSlot 이 슬롯을 읽은 바로 뒤, 예약 행을 넣기 전에 '본인 = 호스트'를 거른다. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("bookSlot: 본인 = 호스트면 예약 행을 넣기 전에 막는다", () => {
  const src = readFileSync("src/lib/slots.ts", "utf8");
  const start = src.indexOf("export async function bookSlot(");
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf("\nexport ", start + 10));
  const guard = body.search(/if \(guestId && guestId === slot\.host_id\) return \{ error:/);
  const slotRead = body.indexOf('.eq("id", args.slotId)');
  const insert = body.indexOf(".insert(");
  assert.ok(guard > 0, "자기 링크 막는 줄이 있어야 함");
  assert.ok(slotRead > 0 && slotRead < guard, "슬롯을 읽은 뒤");
  assert.ok(insert > guard, "예약 행을 넣기 전");
});
