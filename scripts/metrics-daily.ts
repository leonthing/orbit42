/**
 * 지표 한 줄 (읽기 전용) — PO_orbit42/지표기록.md 에 붙일 숫자만 출력한다.
 * 실행: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/metrics-daily.ts
 * 내부 계정(INTERNAL)은 '외부' 값에서 뺀다. 개인 식별 정보는 출력하지 않는다.
 */
import { getAdminClient } from "@/lib/supabase";

const INTERNAL = ["leokim5854", "appreview", "leotaurus13"]; // Leo 본인·심사 데모·leotaurus13(10/25 Leo 테스트 구글 계정으로 재가입). 시드 데모 5명은 10/22 삭제

(async () => {
  const db = getAdminClient();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: internalRows } = await db.from("users").select("id").in("username", INTERNAL);
  const internal = new Set((internalRows ?? []).map((r) => r.id as string));

  const allUsers: { id: string; created_at: string; google_refresh_token: string | null; first_link_shared_at: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("users").select("id, created_at, google_refresh_token, first_link_shared_at").range(from, from + 999);
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
  // 가입 7일 안 링크 공유 비율 — 가입한 지 7일이 지난 최근 30일 가입자(외부) 중 7일 안에 처음 공유한 사람 (1.6.0 ①)
  const since30 = Date.now() - 30 * 86_400_000;
  const cohort = ext.filter((u) => {
    const t = Date.parse(u.created_at);
    return t >= since30 && t <= Date.now() - 7 * 86_400_000;
  });
  const sharedIn7 = cohort.filter((u) =>
    u.first_link_shared_at && Date.parse(u.first_link_shared_at) - Date.parse(u.created_at) <= 7 * 86_400_000,
  );
  const pct = cohort.length ? Math.round((sharedIn7.length / cohort.length) * 100) : null;

  console.log(JSON.stringify({
    가입자: `${ext.length}(전체 ${allUsers.length})`,
    새가입_7일: both(ext.filter((u) => u.created_at >= since7).map((u) => u.id).concat(allUsers.filter((u) => internal.has(u.id) && u.created_at >= since7).map((u) => u.id))),
    구글연결: both(googleIds),
    활성_7일: both(active),
    활성예약링크_호스트: both(hosts),
    받은예약_7일: both((bk ?? []).map((r) => r.host_id as string)),
    가입7일안_링크공유: `${sharedIn7.length}/${cohort.length}${pct === null ? "" : ` (${pct}%)`}`,
  }));
})();
