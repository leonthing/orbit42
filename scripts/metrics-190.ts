/**
 * 1.9.0 성공 기준 (읽기 전용) — 사람 이름·글 내용은 출력하지 않고 숫자만.
 * 실행: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/metrics-190.ts [--days 7] [--include-internal]
 *
 * ① 1:1 대화 → 예약: 대화를 시작한 사람(요청자, 바로 대화면 첫 글을 쓴 사람) 중 그 뒤 7일 안에 같은 상대에게 예약한 비율.
 *    '예약 링크를 연 비율'은 지금 기록이 없다(예약 링크 방문 흐름은 사람을 남기지 않는 익명 횟수) — 대신 예약까지 간 비율을 센다.
 *    ①-2 앱 대화방 '예약 링크 보기'로 들어온 방문(출처 dm, 익명 횟수): 프로필 열람·예약 링크 열람·시간 고름 — 대화 시작 수와 비교.
 * ② 완료한 일정 중 후속(후속 일정 연결 또는 원래 일정이 그 일정인 할 일)이 붙은 비율 — 기간 안에 완료한 일정 기준.
 * ③ 할 일 체크율: 만든 지 14일 지난 할 일 중 done_at 이 있는 비율.
 */
import { getAdminClient } from "@/lib/supabase";
import { normalizeEventKey } from "@/lib/event-key";

const INTERNAL = ["leokim", "appreview", "leotaurus13"];
const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 7;
const includeInternal = args.includes("--include-internal");

(async () => {
  const db = getAdminClient();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: internalRows } = await db.from("users").select("id").in("username", INTERNAL);
  const internal = new Set(includeInternal ? [] : (internalRows ?? []).map((u) => u.id as string));

  // ① 대화 → 예약
  const { data: convs } = await db.from("conversations").select("id, user_a, user_b, requested_by, created_at").gte("created_at", since);
  let starters = 0, booked = 0;
  for (const c of convs ?? []) {
    let starter = c.requested_by as string | null;
    if (!starter) {
      const { data: first } = await db.from("messages").select("sender_id").eq("conversation_id", c.id).order("created_at").limit(1);
      starter = (first?.[0]?.sender_id as string | undefined) ?? null;
    }
    if (!starter || internal.has(starter)) continue;
    const peer = starter === c.user_a ? c.user_b : c.user_a;
    starters++;
    const until = new Date(new Date(c.created_at as string).getTime() + 7 * 864e5).toISOString();
    const { count } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", starter)
      .eq("host_id", peer)
      .gte("created_at", c.created_at as string)
      .lte("created_at", until);
    if ((count ?? 0) > 0) booked++;
  }

  // ①-2 대화방 → 예약 링크 방문 (익명 횟수, booking_funnel_ref_daily ref='dm')
  const sinceDay = new Date(Date.now() - days * 864e5 + 9 * 3600e3).toISOString().slice(0, 10);
  const { data: dmRef } = await db.from("booking_funnel_ref_daily").select("host_id, step, count").eq("ref", "dm").gte("day", sinceDay);
  const dmSteps: Record<string, number> = {};
  for (const r of dmRef ?? []) {
    if (internal.has(r.host_id as string)) continue;
    dmSteps[r.step as string] = (dmSteps[r.step as string] ?? 0) + (r.count as number);
  }

  // ② 완료 일정 중 후속이 붙은 비율
  const { data: done } = await db.from("event_completions").select("user_id, event_key").eq("status", "done").gte("completed_at", since).limit(10000);
  const doneRows = (done ?? []).filter((r) => !internal.has(r.user_id as string));
  const users = Array.from(new Set(doneRows.map((r) => r.user_id as string)));
  const withFollow = new Set<string>();
  for (let i = 0; i < users.length; i += 100) {
    const chunk = users.slice(i, i + 100);
    const [{ data: fu }, { data: td }] = await Promise.all([
      db.from("event_follow_ups").select("user_id, source_key").in("user_id", chunk),
      db.from("todos").select("user_id, source_event_key").in("user_id", chunk).not("source_event_key", "is", null),
    ]);
    for (const r of fu ?? []) withFollow.add(`${r.user_id}|${normalizeEventKey(r.source_key as string)}`);
    for (const r of td ?? []) withFollow.add(`${r.user_id}|${normalizeEventKey(r.source_event_key as string)}`);
  }
  const followed = doneRows.filter((r) => withFollow.has(`${r.user_id}|${r.event_key}`)).length;

  // ③ 할 일 체크율 (만든 지 14일 지난 것)
  const cutoff = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: todos } = await db.from("todos").select("user_id, done_at").lte("created_at", cutoff).limit(50000);
  const tRows = (todos ?? []).filter((r) => !internal.has(r.user_id as string));
  const checked = tRows.filter((r) => r.done_at).length;

  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "-");
  console.log(`기간: 최근 ${days}일${includeInternal ? " (내부 계정 포함)" : ""}`);
  console.log(`① 대화 시작 ${starters}명 → 7일 안 같은 상대 예약 ${booked} (${pct(booked, starters)})`);
  console.log(`①-2 대화방 '예약 링크 보기' 경유: 프로필 ${dmSteps.profile_view ?? 0} → 예약 링크 ${dmSteps.slot_view ?? 0} → 시간 고름 ${dmSteps.time_picked ?? 0} (대화 시작 ${starters} 대비 ${pct(dmSteps.profile_view ?? 0, starters)})`);
  console.log(`② 완료한 일정 ${doneRows.length}개 → 후속 붙음 ${followed} (${pct(followed, doneRows.length)})`);
  console.log(`③ 만든 지 14일 지난 할 일 ${tRows.length}개 → 체크 ${checked} (${pct(checked, tRows.length)})`);
})();
