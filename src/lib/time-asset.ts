/**
 * 시간 자산화 — "내 1시간 = 얼마" 환산과 시간 사용 버킷 분석.
 *
 * 급여(월급/시급) 기준으로 시간당 가치를 구하고, 캘린더 용도(purpose)를
 * 수입/투자/소비/생활 4개 버킷으로 묶어 주간 사용을 금액으로 번역한다.
 * 토스/뱅크샐러드의 자산 홈처럼 "시간이 곧 자산"을 명확히 보여주는 게 목적.
 */

import { getAdminClient } from "@/lib/supabase";
import {
  getWeekInsights,
  fetchTimeBlocks,
  getWorkHours,
  weekStartMonday,
  type TimeBlock,
} from "@/lib/insights";
import type { CalendarPurpose } from "@/lib/calendar-settings-types";
import { getValueStats } from "@/lib/value-stats";

/** 한국 근로기준 월 소정근로시간 (주휴 포함) — 월급 → 시급 환산 기준. */
export const MONTHLY_WORK_HOURS = 209;

export type IncomeType = "monthly" | "hourly";

export type BucketKey = "earn" | "invest" | "spend" | "life";

/** purpose → 버킷 매핑. 수입=지금 돈 버는 시간, 투자=미래 가치를 올리는 시간,
 * 소비=즐기는 시간, 생활=그 외 일상. */
const BUCKET_OF: Record<CalendarPurpose, BucketKey> = {
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
}> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("income_type, income_amount")
    .eq("id", userId)
    .single();
  const incomeType = (data?.income_type as IncomeType | null) ?? null;
  const amount =
    data?.income_amount != null ? Number(data.income_amount) : null;
  return {
    incomeType,
    amount,
    hourlyValueKrw: hourlyValue(incomeType, amount),
  };
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
  /** 168h 중 캘린더에 없는 시간 (수면·미기록 등) */
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
): Record<BucketKey, number> {
  const acc = emptyBuckets();
  for (const p of byPurpose) {
    const key: BucketKey =
      p.purpose === "null" ? "life" : BUCKET_OF[p.purpose] ?? "life";
    acc[key] += p.hours;
  }
  return acc;
}

export async function getTimeAssetSummary(
  userId: string,
  username: string,
  anchor: Date = new Date(),
): Promise<TimeAssetSummary> {
  const [income, workHours] = await Promise.all([
    getIncomeSettings(userId),
    getWorkHours(userId),
  ]);
  const hourly = income.hourlyValueKrw;

  const weekStart = weekStartMonday(anchor);
  const TREND_WEEKS = 4;
  const trendStart = new Date(
    weekStart.getTime() - (TREND_WEEKS - 1) * 7 * 24 * 60 * 60_000,
  );
  const trendEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const [week, trendBlocks, value] = await Promise.all([
    getWeekInsights(userId, weekStart, workHours),
    fetchTimeBlocks(userId, trendStart, trendEnd),
    getValueStats(username),
  ]);

  // 4주 추이: 주 단위로 겹치는 구간만 잘라 purpose → 버킷으로 정밀 집계.
  const trend: Array<{ weekStart: string; hoursByBucket: Record<BucketKey, number> }> = [];
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
      const key: BucketKey = b.purpose ? BUCKET_OF[b.purpose] ?? "life" : "life";
      acc[key] += overlap / 3_600_000;
    }
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

  const hoursByBucket = bucketize(week.by_purpose);
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
    unrecordedHours: Math.max(0, Math.round((168 - scheduled) * 10) / 10),
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
