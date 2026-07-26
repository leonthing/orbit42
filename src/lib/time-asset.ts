/**
 * 시간 자산화 — "내 1시간 = 얼마" 환산과 시간 사용 버킷 분석.
 *
 * 급여(월급/시급) 기준으로 시간당 가치를 구하고, 캘린더 용도(purpose)를
 * 수입/투자/소비/생활 4개 버킷으로 묶어 주간 사용을 금액으로 번역한다.
 * 토스/뱅크샐러드의 자산 홈처럼 "시간이 곧 자산"을 명확히 보여주는 게 목적.
 */

import { getAdminClient } from "@/lib/supabase";
import { fetchTimeBlocks, weekStartMonday } from "@/lib/insights";
import type { CalendarPurpose } from "@/lib/calendar-settings-types";
import { getValueStats } from "@/lib/value-stats";

/** 한국 근로기준 월 소정근로시간 (주휴 포함) — 월급 → 시급 환산 기준. */
export const MONTHLY_WORK_HOURS = 209;

export type IncomeType = "monthly" | "hourly";

export type BucketKey = "earn" | "invest" | "spend" | "life";

/** 기본 purpose → 버킷 매핑. 수입=지금 돈 버는 시간, 투자=미래 가치를 올리는
 * 시간, 소비=즐기는 시간, 생활=그 외 일상. 사용자가 users.bucket_map 으로
 * 용도별 오버라이드 가능. */
export const DEFAULT_BUCKET_MAP: Record<CalendarPurpose, BucketKey> = {
  work: "earn",
  income: "earn",
  learning: "invest",
  health: "invest",
  hobby: "spend",
  social: "spend",
  couple: "spend",
  personal: "life",
  other: "life",
};

export const BUCKET_KEYS: BucketKey[] = ["earn", "invest", "spend", "life"];

/** 기본 매핑 위에 사용자 오버라이드를 얹은 유효 매핑. */
export function effectiveBucketMap(
  overrides: Partial<Record<CalendarPurpose, BucketKey>> | null,
): Record<CalendarPurpose, BucketKey> {
  const map = { ...DEFAULT_BUCKET_MAP };
  if (overrides) {
    for (const [purpose, bucket] of Object.entries(overrides)) {
      if (
        purpose in DEFAULT_BUCKET_MAP &&
        BUCKET_KEYS.includes(bucket as BucketKey)
      ) {
        map[purpose as CalendarPurpose] = bucket as BucketKey;
      }
    }
  }
  return map;
}

export const BUCKET_META: Record<
  BucketKey,
  { label: string; description: string; color: string }
> = {
  earn: { label: "수입", description: "지금 돈을 버는 시간", color: "#6366f1" },
  invest: { label: "투자", description: "미래 가치를 올리는 시간", color: "#22c55e" },
  spend: { label: "소비", description: "즐기고 쉬는 시간", color: "#f59e0b" },
  life: { label: "생활", description: "그 외 일상", color: "#64748b" },
};

export async function getIncomeSettings(userId: string): Promise<{
  incomeType: IncomeType | null;
  amount: number | null;
  hourlyValueKrw: number | null;
  bucketMap: Record<CalendarPurpose, BucketKey>;
  sleepHoursPerDay: number;
}> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("income_type, income_amount, bucket_map, sleep_hours")
    .eq("id", userId)
    .single();
  const incomeType = (data?.income_type as IncomeType | null) ?? null;
  const amount =
    data?.income_amount != null ? Number(data.income_amount) : null;
  return {
    incomeType,
    amount,
    hourlyValueKrw: hourlyValue(incomeType, amount),
    bucketMap: effectiveBucketMap(
      (data?.bucket_map as Partial<Record<CalendarPurpose, BucketKey>> | null) ??
        null,
    ),
    sleepHoursPerDay:
      data?.sleep_hours != null ? Number(data.sleep_hours) : DEFAULT_SLEEP_HOURS,
  };
}

/** 수면 기본값 (시간/일) — 설정 전에도 미기록 시간을 의미 있게 쪼개기 위함. */
export const DEFAULT_SLEEP_HOURS = 7;

export async function saveSleepHours(userId: string, hoursPerDay: number) {
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({
      sleep_hours: hoursPerDay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("saveSleepHours", error);
    return { error: "저장에 실패했어요." };
  }
  return { ok: true as const };
}

// ---------- 이벤트 단위 버킷 재분류 ----------

/** 사용자의 이벤트별 버킷 오버라이드 맵 (event_key → bucket). */
export async function listEventBucketOverrides(
  userId: string,
): Promise<Map<string, BucketKey>> {
  const db = getAdminClient();
  const { data } = await db
    .from("event_bucket_overrides")
    .select("event_key, bucket")
    .eq("user_id", userId);
  const map = new Map<string, BucketKey>();
  for (const row of data ?? []) {
    if (BUCKET_KEYS.includes(row.bucket as BucketKey)) {
      map.set(row.event_key as string, row.bucket as BucketKey);
    }
  }
  return map;
}

/** 이벤트 버킷 지정/해제. bucket=null 이면 캘린더 용도 기본값으로 복귀. */
export async function setEventBucket(
  userId: string,
  eventKey: string,
  bucket: BucketKey | null,
) {
  const db = getAdminClient();
  if (bucket === null) {
    const { error } = await db
      .from("event_bucket_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("event_key", eventKey);
    if (error) return { error: "해제에 실패했어요." };
    return { ok: true as const };
  }
  const { error } = await db
    .from("event_bucket_overrides")
    .upsert(
      { user_id: userId, event_key: eventKey, bucket },
      { onConflict: "user_id,event_key" },
    );
  if (error) {
    console.error("setEventBucket", error);
    return { error: "저장에 실패했어요." };
  }
  return { ok: true as const };
}

export async function saveBucketMap(
  userId: string,
  overrides: Partial<Record<CalendarPurpose, BucketKey>>,
) {
  const db = getAdminClient();
  // 기본값과 같은 항목은 저장하지 않아 오버라이드만 남긴다.
  const trimmed: Record<string, BucketKey> = {};
  for (const [purpose, bucket] of Object.entries(overrides)) {
    if (
      purpose in DEFAULT_BUCKET_MAP &&
      BUCKET_KEYS.includes(bucket as BucketKey) &&
      DEFAULT_BUCKET_MAP[purpose as CalendarPurpose] !== bucket
    ) {
      trimmed[purpose] = bucket as BucketKey;
    }
  }
  const { error } = await db
    .from("users")
    .update({
      bucket_map: Object.keys(trimmed).length > 0 ? trimmed : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("saveBucketMap", error);
    return { error: "저장에 실패했어요." };
  }
  return { ok: true as const };
}

export function hourlyValue(
  incomeType: IncomeType | null,
  amount: number | null,
): number | null {
  if (!incomeType || amount == null || amount <= 0) return null;
  if (incomeType === "hourly") return Math.round(amount);
  return Math.round(amount / MONTHLY_WORK_HOURS);
}

export async function saveIncomeSettings(
  userId: string,
  incomeType: IncomeType,
  amount: number,
) {
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({
      income_type: incomeType,
      income_amount: Math.round(amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("saveIncomeSettings", error);
    return { error: "저장에 실패했어요." };
  }
  return { ok: true as const };
}

export type BucketStat = {
  key: BucketKey;
  label: string;
  description: string;
  color: string;
  hours: number;
  /** 시급 기준 환산 금액(원). 시급 미설정이면 null. */
  valueKrw: number | null;
  /** 기록된 시간 중 비율 (0~1). */
  ratio: number;
};

export type TimeAssetSummary = {
  hourlyValueKrw: number | null;
  /** 근로시간 기준 환산: 하루 8h / 주 40h / 월 209h / 연 209×12h */
  conversions: {
    day: number;
    week: number;
    month: number;
    year: number;
  } | null;
  weekStart: string;
  buckets: BucketStat[];
  scheduledHours: number;
  /** 수면 설정 (시간/일) 과 주간 환산 */
  sleepHoursPerDay: number;
  sleepHoursPerWeek: number;
  /** 168h 중 기록도 수면도 아닌 나머지 시간 */
  unrecordedHours: number;
  trend: Array<{
    weekStart: string;
    hoursByBucket: Record<BucketKey, number>;
  }>;
  /** 실제 슬롯 거래로 번 돈 — 기준 시급과 비교용 */
  traded: {
    totalBookings: number;
    totalHours: number;
    totalKrw: number;
    impliedHourlyKrw: number | null;
    /** 내 기준 시급 대비 판매 단가 배수 (둘 다 있을 때만) */
    vsIncomeRatio: number | null;
  };
  /** 규칙 기반 한 줄 인사이트 */
  messages: string[];
};

function emptyBuckets(): Record<BucketKey, number> {
  return { earn: 0, invest: 0, spend: 0, life: 0 };
}

function bucketize(
  byPurpose: Array<{ purpose: CalendarPurpose | "null"; hours: number }>,
  map: Record<CalendarPurpose, BucketKey>,
): Record<BucketKey, number> {
  const acc = emptyBuckets();
  for (const p of byPurpose) {
    const key: BucketKey =
      p.purpose === "null" ? "life" : map[p.purpose] ?? "life";
    acc[key] += p.hours;
  }
  return acc;
}

export async function getTimeAssetSummary(
  userId: string,
  username: string,
  anchor: Date = new Date(),
): Promise<TimeAssetSummary> {
  const income = await getIncomeSettings(userId);
  const hourly = income.hourlyValueKrw;

  const weekStart = weekStartMonday(anchor);
  const TREND_WEEKS = 4;
  const trendStart = new Date(
    weekStart.getTime() - (TREND_WEEKS - 1) * 7 * 24 * 60 * 60_000,
  );
  const trendEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const [trendBlocks, overrides, value] = await Promise.all([
    fetchTimeBlocks(userId, trendStart, trendEnd),
    listEventBucketOverrides(userId),
    getValueStats(username),
  ]);

  // 이벤트의 버킷: 개별 오버라이드 > 캘린더 용도 매핑 > 생활.
  const bucketOf = (b: { id: string; purpose: CalendarPurpose | null }): BucketKey =>
    overrides.get(b.id) ??
    (b.purpose ? income.bucketMap[b.purpose] ?? "life" : "life");

  // 4주 추이: 주 단위로 겹치는 구간만 잘라 정밀 집계. 마지막 주가 이번 주.
  const trend: Array<{ weekStart: string; hoursByBucket: Record<BucketKey, number> }> = [];
  let currentWeekAcc = emptyBuckets();
  for (let i = 0; i < TREND_WEEKS; i++) {
    const ws = new Date(trendStart.getTime() + i * 7 * 24 * 60 * 60_000);
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60_000);
    const acc = emptyBuckets();
    for (const b of trendBlocks) {
      if (b.all_day) continue;
      const overlap =
        Math.min(b.end.getTime(), we.getTime()) -
        Math.max(b.start.getTime(), ws.getTime());
      if (overlap <= 0) continue;
      acc[bucketOf(b)] += overlap / 3_600_000;
    }
    if (i === TREND_WEEKS - 1) currentWeekAcc = acc;
    trend.push({
      weekStart: ws.toISOString(),
      hoursByBucket: {
        earn: Math.round(acc.earn * 10) / 10,
        invest: Math.round(acc.invest * 10) / 10,
        spend: Math.round(acc.spend * 10) / 10,
        life: Math.round(acc.life * 10) / 10,
      },
    });
  }

  const hoursByBucket = currentWeekAcc;
  const scheduled = Object.values(hoursByBucket).reduce((a, b) => a + b, 0);
  const buckets: BucketStat[] = (
    Object.keys(BUCKET_META) as BucketKey[]
  ).map((key) => {
    const hours = Math.round(hoursByBucket[key] * 10) / 10;
    return {
      key,
      ...BUCKET_META[key],
      hours,
      valueKrw: hourly != null ? Math.round(hours * hourly) : null,
      ratio: scheduled > 0 ? hoursByBucket[key] / scheduled : 0,
    };
  });

  // 실거래: value-stats 는 cents(원×100) 단위.
  const tradedKrw = Math.round(value.total_revenue_cents / 100);
  const impliedHourly =
    value.hourly_rate_cents != null
      ? Math.round(value.hourly_rate_cents / 100)
      : null;

  // 규칙 기반 인사이트 문구.
  const messages: string[] = [];
  const prevWeek = trend.length >= 2 ? trend[trend.length - 2] : null;
  if (prevWeek) {
    const prevInvest = prevWeek.hoursByBucket.invest;
    const diff = hoursByBucket.invest - prevInvest;
    if (diff >= 2) {
      messages.push(
        `투자 시간이 지난주보다 ${Math.round(diff)}시간 늘었어요. 미래 자산이 쌓이는 중!`,
      );
    }
  }
  const investRatio = scheduled > 0 ? hoursByBucket.invest / scheduled : 0;
  const earnRatio = scheduled > 0 ? hoursByBucket.earn / scheduled : 0;
  if (hourly != null && hoursByBucket.spend > 0) {
    messages.push(
      `이번 주 소비 시간 ${Math.round(hoursByBucket.spend)}시간은 약 ₩${Math.round(hoursByBucket.spend * hourly).toLocaleString("ko-KR")}어치예요.`,
    );
  }
  if (investRatio >= 0.2) {
    messages.push("기록된 시간의 20% 이상을 미래에 투자하고 있어요. 좋은 배분이에요.");
  } else if (scheduled > 0 && investRatio < 0.05) {
    messages.push("이번 주 투자(학습·건강) 시간이 5% 미만이에요. 한 블록만 늘려볼까요?");
  }
  if (impliedHourly != null && hourly != null && hourly > 0) {
    const ratio = impliedHourly / hourly;
    if (ratio >= 1.2) {
      messages.push(
        `슬롯 판매 단가(₩${impliedHourly.toLocaleString("ko-KR")}/시간)가 기준 시급의 ${ratio.toFixed(1)}배예요. 시간의 시장 가치가 더 높네요.`,
      );
    }
  }
  if (scheduled > 0 && earnRatio > 0.7) {
    messages.push("기록 시간의 70% 이상이 수입 활동이에요. 소비·투자 균형도 챙겨보세요.");
  }

  return {
    hourlyValueKrw: hourly,
    conversions:
      hourly != null
        ? {
            day: hourly * 8,
            week: hourly * 40,
            month: hourly * MONTHLY_WORK_HOURS,
            year: hourly * MONTHLY_WORK_HOURS * 12,
          }
        : null,
    weekStart: weekStart.toISOString(),
    buckets,
    scheduledHours: Math.round(scheduled * 10) / 10,
    sleepHoursPerDay: income.sleepHoursPerDay,
    sleepHoursPerWeek: Math.round(income.sleepHoursPerDay * 7 * 10) / 10,
    unrecordedHours: Math.max(
      0,
      Math.round((168 - scheduled - income.sleepHoursPerDay * 7) * 10) / 10,
    ),
    trend,
    traded: {
      totalBookings: value.total_bookings,
      totalHours: Math.round(value.total_booked_hours * 10) / 10,
      totalKrw: tradedKrw,
      impliedHourlyKrw: impliedHourly,
      vsIncomeRatio:
        impliedHourly != null && hourly != null && hourly > 0
          ? Math.round((impliedHourly / hourly) * 10) / 10
          : null,
    },
    messages,
  };
}
