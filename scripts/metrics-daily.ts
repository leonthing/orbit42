/**
 * 지표 한 줄 (읽기 전용) — PO_orbit42/지표기록.md 에 붙일 숫자만 출력한다.
 * 실행: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/metrics-daily.ts
 * 내부 계정(INTERNAL)은 '외부' 값에서 뺀다. 개인 식별 정보는 출력하지 않는다.
 */
import { getAdminClient } from "@/lib/supabase";

const INTERNAL = ["leokim5854", "leotaurus13", "appreview", "mina", "junho", "sora", "daeun", "theo"]; // Leo 본인·테스트·심사 데모·시드(seed-demo.mjs)

(async () => {
  const db = getAdminClient();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: internalRows } = await db.from("users").select("id").in("username", INTERNAL);
  const internal = new Set((internalRows ?? []).map((r) => r.id as string));

  const allUsers: { id: string; created_at: string; google_refresh_token: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("users").select("id, created_at, google_refresh_token").range(from, from + 999);
    allUsers.push(...((data ?? []) as typeof allUsers));
    if (!data || data.length < 1000) break;
  }
  const ext = allUsers.filter((u) => !internal.has(u.id));
  const { data: extraGoogle } = await db.from("google_accounts").select("user_id");
  const googleIds = new Set([
    ...allUsers.filter((u) => u.google_refresh_token).map((u) => u.id),
    ...(extraGoogle ?? []).map((r) => r.user_id as string),
  ]);

  const { data: ev } = await db.from("events").select("user_id").gte("created_at", since7).is("booking_id", null);
  const { data: done } = await db.from("event_completions").select("user_id").gte("completed_at", since7);
  const active = new Set([...(ev ?? []), ...(done ?? [])].map((r) => r.user_id as string));
  const { data: slots } = await db.from("time_slots").select("host_id").eq("active", true);
  const hosts = new Set((slots ?? []).map((r) => r.host_id as string));
  const { data: bk } = await db.from("bookings").select("host_id").gte("created_at", since7);

  const both = (s: Set<string> | string[]) => {
    const arr = Array.isArray(s) ? s : Array.from(s);
    return `${arr.filter((id) => !internal.has(id)).length}(전체 ${arr.length})`;
  };
  console.log(JSON.stringify({
    가입자: `${ext.length}(전체 ${allUsers.length})`,
    새가입_7일: both(ext.filter((u) => u.created_at >= since7).map((u) => u.id).concat(allUsers.filter((u) => internal.has(u.id) && u.created_at >= since7).map((u) => u.id))),
    구글연결: both(googleIds),
    활성_7일: both(active),
    활성예약링크_호스트: both(hosts),
    받은예약_7일: both((bk ?? []).map((r) => r.host_id as string)),
  }));
})();
