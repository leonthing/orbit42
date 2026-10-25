/**
 * 예약 링크 방문 흐름 (읽기 전용, 개선-32) — 최근 7일·30일 단계별 합계와 단계 사이 비율.
 * 실행: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/funnel.ts [--include-internal] [--by-host]
 * 호스트 이름은 출력하지 않고 H1~Hn(기간 합계 많은 순)으로만 보인다. 기본은 내부 계정 제외.
 * 저장된 값은 날짜·호스트·예약 링크·단계·출처별 횟수뿐 — 사람을 알아볼 값은 없다.
 */
import { getAdminClient } from "@/lib/supabase";

// scripts/metrics-daily.ts 와 같은 내부 계정 목록 (지표기록.md 기준)
const INTERNAL = ["leokim5854", "appreview", "leotaurus13"]; // leotaurus13: 10/25 Leo 테스트 구글 계정으로 재가입
const STEPS = ["profile_view", "slot_view", "time_picked", "booked"] as const;
const LABEL: Record<(typeof STEPS)[number], string> = {
  profile_view: "① 링크(프로필) 열람",
  slot_view: "② 예약 링크 열람",
  time_picked: "③ 시간 고름",
  booked: "④ 예약 성공",
};

type Row = { day: string; host_id: string; step: (typeof STEPS)[number]; source: "web" | "ios"; count: number };

function kstDay(offsetDays: number) {
  return new Date(Date.now() + 9 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function pct(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "—";
}

function summarize(title: string, rows: Row[], byHost: boolean) {
  const total = (step: string, source?: string) =>
    rows.filter((r) => r.step === step && (!source || r.source === source)).reduce((s, r) => s + r.count, 0);
  console.log(`\n■ ${title}`);
  for (const step of STEPS) {
    console.log(`  ${LABEL[step].padEnd(14)} ${String(total(step)).padStart(5)}  (웹 ${total(step, "web")} · 앱 ${total(step, "ios")})`);
  }
  console.log(
    `  비율  ①→② ${pct(total("slot_view"), total("profile_view"))} · ②→③ ${pct(total("time_picked"), total("slot_view"))} · ③→④ ${pct(total("booked"), total("time_picked"))} · ②→④ ${pct(total("booked"), total("slot_view"))}`,
  );
  if (!byHost) return;
  const hosts = new Map<string, number>();
  for (const r of rows) hosts.set(r.host_id, (hosts.get(r.host_id) ?? 0) + r.count);
  const order = Array.from(hosts.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  order.forEach((id, i) => {
    const t = (step: string) => rows.filter((r) => r.host_id === id && r.step === step).reduce((s, r) => s + r.count, 0);
    console.log(`  H${i + 1}: ${STEPS.map((s) => t(s)).join(" → ")}`);
  });
}

(async () => {
  const includeInternal = process.argv.includes("--include-internal");
  const byHost = process.argv.includes("--by-host");
  const db = getAdminClient();
  const since = kstDay(29);
  const { data, error } = await db
    .from("booking_funnel_daily")
    .select("day, host_id, step, source, count")
    .gte("day", since);
  if (error) throw error;
  let rows = (data ?? []) as Row[];
  if (!includeInternal) {
    const { data: internal } = await db.from("users").select("id").in("username", INTERNAL);
    const ids = new Set((internal ?? []).map((r) => r.id as string));
    rows = rows.filter((r) => !ids.has(r.host_id));
  }
  console.log(`예약 링크 방문 흐름 (한국 시간, ${includeInternal ? "내부 계정 포함" : "내부 계정 제외"})`);
  summarize(`최근 7일 (${kstDay(6)} ~ ${kstDay(0)})`, rows.filter((r) => r.day >= kstDay(6)), byHost);
  summarize(`최근 30일 (${since} ~ ${kstDay(0)})`, rows, byHost);
})();
