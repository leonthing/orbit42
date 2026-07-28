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

export type IncomeType = "monthly" | "hourly" | "freelance";

export type BucketKey = "earn" | "invest" | "spend" | "life";

/** 기본 purpose → 버킷 매핑. 수입=지금 돈 버는 시간, 투자=미래 가치를 올리는
 * 시간, 소비=즐기는 시간, 생활=그 외 일상. 사용자가 users.bucket_map 으로
 * 용도별 오버라이드 가능. */
export const DEFAULT_BUCKET_MAP: Record<CalendarPurpose, BucketKey> = {
  work: "earn",
  income: "earn",
  invest: "invest",
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
  birthDate: string | null;
  weeklyEarnGoalKrw: number | null;
  weeklyInvestGoalHours: number | null;
}> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select(
      "income_type, income_amount, bucket_map, sleep_hours, birth_date, weekly_earn_goal_krw, weekly_invest_goal_hours",
    )
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
    birthDate: (data?.birth_date as string | null) ?? null,
    weeklyEarnGoalKrw:
      data?.weekly_earn_goal_krw != null ? Number(data.weekly_earn_goal_krw) : null,
    weeklyInvestGoalHours:
      data?.weekly_invest_goal_hours != null
        ? Number(data.weekly_invest_goal_hours)
        : null,
  };
}

/** 주간 목표 저장 — undefined 는 유지, null 은 해제. */
export async function saveWeeklyGoals(
  userId: string,
  goals: { earnKrw?: number | null; investHours?: number | null },
) {
  const db = getAdminClient();
  const patch: Record<string, unknown> = {};
  if (goals.earnKrw !== undefined) patch.weekly_earn_goal_krw = goals.earnKrw;
  if (goals.investHours !== undefined) {
    patch.weekly_invest_goal_hours = goals.investHours;
  }
  if (Object.keys(patch).length === 0) return { ok: true as const };
  const { error } = await db.from("users").update(patch).eq("id", userId);
  if (error) return { error: "목표를 저장하지 못했어요." };
  return { ok: true as const };
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

// ── 이벤트별 수익 기록 (event_earnings) ─────────────────────────
// 키는 이벤트 분류(event_bucket_overrides)와 같은 클라이언트 원형 id
// (로컬 uuid / "gcal_<id>"). 수입 버킷 금액 계산에서 시급×시간 대신 쓰인다.

export async function listEventEarnings(
  userId: string,
): Promise<Map<string, number>> {
  const db = getAdminClient();
  const { data } = await db
    .from("event_earnings")
    .select("event_key, amount_krw")
    .eq("user_id", userId);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.event_key as string, Number(row.amount_krw));
  }
  return map;
}

export async function setEventEarning(
  userId: string,
  eventKey: string,
  amountKrw: number | null,
) {
  const db = getAdminClient();
  if (amountKrw === null) {
    const { error } = await db
      .from("event_earnings")
      .delete()
      .eq("user_id", userId)
      .eq("event_key", eventKey);
    if (error) return { error: "해제에 실패했어요." };
    return { ok: true as const };
  }
  const { error } = await db
    .from("event_earnings")
    .upsert(
      {
        user_id: userId,
        event_key: eventKey,
        amount_krw: Math.round(amountKrw),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_key" },
    );
  if (error) {
    console.error("setEventEarning", error);
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
  // freelance 는 월별 수입 기록으로 실효 시급을 따로 계산한다 (summary에서).
  if (incomeType === "freelance") return null;
  if (!incomeType || amount == null || amount <= 0) return null;
  if (incomeType === "hourly") return Math.round(amount);
  return Math.round(amount / MONTHLY_WORK_HOURS);
}

// ---------- 프리랜서 월별 수입 기록 ----------

export type IncomeEntry = { month: string; amountKrw: number };

export async function listIncomeEntries(
  userId: string,
  limit = 12,
): Promise<IncomeEntry[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("income_entries")
    .select("month, amount")
    .eq("user_id", userId)
    .order("month", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    month: r.month as string,
    amountKrw: Number(r.amount),
  }));
}

export async function upsertIncomeEntry(
  userId: string,
  month: string,
  amountKrw: number,
) {
  const db = getAdminClient();
  const { error } = await db.from("income_entries").upsert(
    {
      user_id: userId,
      month,
      amount: Math.round(amountKrw),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" },
  );
  if (error) {
    console.error("upsertIncomeEntry", error);
    return { error: "저장에 실패했어요." };
  }
  return { ok: true as const };
}

export async function deleteIncomeEntry(userId: string, month: string) {
  const db = getAdminClient();
  const { error } = await db
    .from("income_entries")
    .delete()
    .eq("user_id", userId)
    .eq("month", month);
  if (error) return { error: "삭제에 실패했어요." };
  return { ok: true as const };
}

export async function saveIncomeSettings(
  userId: string,
  incomeType: IncomeType,
  amount: number | null,
) {
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({
      income_type: incomeType,
      // freelance 는 고정 금액이 없다 — 월별 기록(income_entries)으로 계산.
      income_amount: amount != null ? Math.round(amount) : null,
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
  /** 지난주 리포트 — 완결된 최근 주를 그 전주와 비교 */
  report: {
    weekStart: string;
    earnedKrw: number | null;
    investHours: number;
    spendHours: number;
    scheduledHours: number;
    lostHours: number;
    deltaEarnedKrw: number | null;
    deltaInvestHours: number;
    deltaLostHours: number;
  };
  /** 올해 남은 시간 자산 — 12/31까지, 수면 제외 기준 */
  yearRemaining: {
    year: number;
    remainingAwakeHours: number;
    remainingValueKrw: number | null;
    /** 올해가 얼마나 지났는지 (0~1) */
    progressRatio: number;
  };
  /** 주간 목표와 이번 주 진행률 (목표 미설정이면 null) */
  goals: {
    earnKrw: number | null;
    investHours: number | null;
    progressEarnKrw: number;
    progressInvestHours: number;
  } | null;
  /** 행동 추천 — 진단을 다음 행동(슬롯 판매·투자·설정)으로 잇는 카드 */
  actions: Array<{
    key: string;
    title: string;
    body: string;
    ctaLabel: string;
    /** "slots" | "calendar" | "profile" | "asset-settings" */
    target: string;
  }>;
  /** 규칙 기반 한 줄 인사이트 */
  messages: string[];
  /** 급여 유형 — freelance 면 실효 시급 모드 */
  incomeType: IncomeType | null;
  /** 프리랜서 모드 상세 (freelance 가 아니면 null) */
  freelance: {
    months: IncomeEntry[];
    totalKrw: number;
    earnHours: number;
    effectiveHourlyKrw: number | null;
  } | null;
};

function emptyBuckets(): Record<BucketKey, number> {
  return { earn: 0, invest: 0, spend: 0, life: 0 };
}

export async function getTimeAssetSummary(
  userId: string,
  username: string,
  anchor: Date = new Date(),
): Promise<TimeAssetSummary> {
  const income = await getIncomeSettings(userId);
  let hourly = income.hourlyValueKrw;

  const weekStart = weekStartMonday(anchor);
  const TREND_WEEKS = 4;
  const trendStart = new Date(
    weekStart.getTime() - (TREND_WEEKS - 1) * 7 * 24 * 60 * 60_000,
  );
  const trendEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const db = getAdminClient();
  const [trendBlocks, overrides, earnings, value, calRatesRes] = await Promise.all([
    fetchTimeBlocks(userId, trendStart, trendEnd),
    listEventBucketOverrides(userId),
    listEventEarnings(userId),
    getValueStats(username),
    db
      .from("calendars")
      .select("id, hourly_rate_krw")
      .eq("user_id", userId)
      .not("hourly_rate_krw", "is", null),
  ]);

  // A2: 캘린더별 단가 (수입 버킷 금액을 실제 매출 추정으로).
  const rateByCalendar = new Map<string, number>();
  for (const c of calRatesRes.data ?? []) {
    if (c.hourly_rate_krw != null && Number(c.hourly_rate_krw) > 0) {
      rateByCalendar.set(c.id as string, Number(c.hourly_rate_krw));
    }
  }

  // 이벤트의 버킷: 개별 오버라이드 > 캘린더 용도 매핑 > 생활.
  // 오버라이드 키는 클라이언트 이벤트 id(로컬 uuid / "gcal_<id>")로 저장되고,
  // fetchTimeBlocks 블록 id 는 "native:<uuid>" / "<구글캘린더ID>::<id>" 형식이라
  // 조회 전에 형식을 맞춰준다.
  const overrideFor = (blockId: string): BucketKey | undefined => {
    if (blockId.startsWith("native:")) {
      return overrides.get(blockId.slice("native:".length));
    }
    const sep = blockId.indexOf("::");
    if (sep >= 0) return overrides.get(`gcal_${blockId.slice(sep + 2)}`);
    return overrides.get(blockId);
  };
  const bucketOf = (b: { id: string; purpose: CalendarPurpose | null }): BucketKey =>
    overrideFor(b.id) ??
    (b.purpose ? income.bucketMap[b.purpose] ?? "life" : "life");

  // 수동 수익 기록 — 오버라이드와 같은 키 형식(uuid/gcal_*)으로 조회.
  const earningFor = (blockId: string): number | undefined => {
    if (blockId.startsWith("native:")) {
      return earnings.get(blockId.slice("native:".length));
    }
    const sep = blockId.indexOf("::");
    if (sep >= 0) return earnings.get(`gcal_${blockId.slice(sep + 2)}`);
    return earnings.get(blockId);
  };

  // A1: 프리랜서 모드 — 최근 기록된 3개월 수입 ÷ 같은 기간 '수입' 시간 = 실효 시급.
  let freelance: TimeAssetSummary["freelance"] = null;
  if (income.incomeType === "freelance") {
    const entries = await listIncomeEntries(userId, 3);
    if (entries.length > 0) {
      const months = entries.map((e) => e.month).sort();
      const [fy, fm] = months[0].split("-").map(Number);
      const [ly, lm] = months[months.length - 1].split("-").map(Number);
      const rangeStart = new Date(fy, fm - 1, 1);
      const rangeEnd = new Date(ly, lm, 1);
      const blocks = await fetchTimeBlocks(userId, rangeStart, rangeEnd);
      const monthSet = new Set(months);
      let earnHours = 0;
      for (const b of blocks) {
        if (b.all_day) continue;
        // 기록된 달에 속한 수입 시간만 집계 (달 경계는 이벤트 시작 기준).
        const key = `${b.start.getFullYear()}-${String(b.start.getMonth() + 1).padStart(2, "0")}`;
        if (!monthSet.has(key)) continue;
        if (bucketOf(b) !== "earn") continue;
        earnHours += (b.end.getTime() - b.start.getTime()) / 3_600_000;
      }
      const totalKrw = entries.reduce((a, e) => a + e.amountKrw, 0);
      const effective =
        earnHours >= 1 ? Math.round(totalKrw / earnHours) : null;
      hourly = effective;
      freelance = {
        months: entries,
        totalKrw,
        earnHours: Math.round(earnHours * 10) / 10,
        effectiveHourlyKrw: effective,
      };
    } else {
      freelance = { months: [], totalKrw: 0, earnHours: 0, effectiveHourlyKrw: null };
    }
  }

  // 4주 추이: 주 단위로 겹치는 구간만 잘라 정밀 집계. 마지막 주가 이번 주.
  const trend: Array<{ weekStart: string; hoursByBucket: Record<BucketKey, number> }> = [];
  let currentWeekAcc = emptyBuckets();
  // 주별 수입 금액 (수동 기록 우선, 없으면 캘린더 단가 → 기준 시급) — 주간 리포트용.
  const weekEarnValues: number[] = [];
  let currentWeekEarnValue = 0;
  let earnRateApplied = false;
  for (let i = 0; i < TREND_WEEKS; i++) {
    const ws = new Date(trendStart.getTime() + i * 7 * 24 * 60 * 60_000);
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60_000);
    const acc = emptyBuckets();
    let weekEarnValue = 0;
    for (const b of trendBlocks) {
      // 수동 수익 기록은 "실제 번 돈"이므로 버킷·종일 여부와 무관하게 해당 주
      // 수입 금액에 합산한다 (시간 비례가 아니라 이벤트 단위 — 시작 시각 기준 1회).
      const manual = earningFor(b.id);
      if (manual != null) {
        if (i === TREND_WEEKS - 1) earnRateApplied = true;
        if (b.start.getTime() >= ws.getTime() && b.start.getTime() < we.getTime()) {
          weekEarnValue += manual;
        }
      }
      if (b.all_day) continue;
      const overlap =
        Math.min(b.end.getTime(), we.getTime()) -
        Math.max(b.start.getTime(), ws.getTime());
      if (overlap <= 0) continue;
      const bucket = bucketOf(b);
      acc[bucket] += overlap / 3_600_000;
      // 자동 계산(캘린더 단가 → 기준 시급)은 수동 기록이 없는 수입 일정만.
      if (bucket === "earn" && manual == null) {
        const rate = rateByCalendar.get(b.calendar_id);
        if (i === TREND_WEEKS - 1 && rate != null) earnRateApplied = true;
        weekEarnValue += (overlap / 3_600_000) * (rate ?? hourly ?? 0);
      }
    }
    weekEarnValues.push(weekEarnValue);
    if (i === TREND_WEEKS - 1) {
      currentWeekAcc = acc;
      currentWeekEarnValue = weekEarnValue;
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

  const hoursByBucket = currentWeekAcc;
  const scheduled = Object.values(hoursByBucket).reduce((a, b) => a + b, 0);
  const buckets: BucketStat[] = (
    Object.keys(BUCKET_META) as BucketKey[]
  ).map((key) => {
    const hours = Math.round(hoursByBucket[key] * 10) / 10;
    const valueKrw =
      key === "earn"
        ? hourly != null || earnRateApplied
          ? Math.round(currentWeekEarnValue)
          : null
        : hourly != null
          ? Math.round(hours * hourly)
          : null;
    return {
      key,
      ...BUCKET_META[key],
      hours,
      valueKrw,
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
  // 잃어버린 자산 프레임 — 기록도 수면도 아닌 시간의 환산 가치.
  const unrecordedForMsg = Math.max(
    0,
    168 - scheduled - income.sleepHoursPerDay * 7,
  );
  if (hourly != null && unrecordedForMsg >= 10) {
    messages.push(
      `이번 주 미기록 시간 ${Math.round(unrecordedForMsg)}시간 ≈ ₩${Math.round(unrecordedForMsg * hourly).toLocaleString("ko-KR")}. 흘러간 시간은 다시 오지 않아요 — 기록이 자산 관리의 시작이에요.`,
    );
  }
  if (
    income.incomeType === "freelance" &&
    freelance &&
    freelance.effectiveHourlyKrw == null
  ) {
    messages.push(
      freelance.months.length === 0
        ? "월별 수입을 기록하면 실제 데이터 기반 실효 시급이 계산돼요."
        : "기록된 달에 '수입' 시간이 아직 없어요. 일한 시간을 수입 캘린더에 기록해보세요.",
    );
  }
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

  // 주간 리포트 — 지난주(완결된 주)를 그 전주와 비교한다.
  const pricingAvailable =
    hourly != null || rateByCalendar.size > 0 || earnings.size > 0;
  const weekStat = (i: number) => {
    const hb = trend[i].hoursByBucket;
    const scheduledW = hb.earn + hb.invest + hb.spend + hb.life;
    return {
      weekStart: trend[i].weekStart,
      earnedKrw: pricingAvailable ? Math.round(weekEarnValues[i]) : null,
      investHours: hb.invest,
      spendHours: hb.spend,
      scheduledHours: Math.round(scheduledW * 10) / 10,
      lostHours: Math.max(
        0,
        Math.round((168 - scheduledW - income.sleepHoursPerDay * 7) * 10) / 10,
      ),
    };
  };
  const lastWeek = weekStat(TREND_WEEKS - 2);
  const priorWeek = weekStat(TREND_WEEKS - 3);
  const report = {
    ...lastWeek,
    deltaEarnedKrw:
      lastWeek.earnedKrw != null && priorWeek.earnedKrw != null
        ? lastWeek.earnedKrw - priorWeek.earnedKrw
        : null,
    deltaInvestHours:
      Math.round((lastWeek.investHours - priorWeek.investHours) * 10) / 10,
    deltaLostHours:
      Math.round((lastWeek.lostHours - priorWeek.lostHours) * 10) / 10,
  };

  // 올해 남은 시간 자산 — 12/31까지 깨어있는 시간 (수면 제외).
  // 평생(기대수명) 환산은 고령 사용자에게 불쾌할 수 있어 1년 단위로 잡는다.
  const yearStart = new Date(anchor.getFullYear(), 0, 1);
  const yearEnd = new Date(anchor.getFullYear() + 1, 0, 1);
  const remainDays = Math.max(0, yearEnd.getTime() - anchor.getTime()) / 86_400_000;
  const awakePerDay = 24 - income.sleepHoursPerDay;
  const remainingAwakeHours = Math.round(remainDays * awakePerDay);
  const yearRemaining: TimeAssetSummary["yearRemaining"] = {
    year: anchor.getFullYear(),
    remainingAwakeHours,
    remainingValueKrw:
      hourly != null ? Math.round(remainingAwakeHours * hourly) : null,
    progressRatio:
      Math.round(
        ((anchor.getTime() - yearStart.getTime()) /
          (yearEnd.getTime() - yearStart.getTime())) *
          1000,
      ) / 1000,
  };

  // 주간 목표 진행률 — 목표가 하나라도 설정돼 있을 때만.
  const goals: TimeAssetSummary["goals"] =
    income.weeklyEarnGoalKrw != null || income.weeklyInvestGoalHours != null
      ? {
          earnKrw: income.weeklyEarnGoalKrw,
          investHours: income.weeklyInvestGoalHours,
          progressEarnKrw: Math.round(currentWeekEarnValue),
          progressInvestHours: Math.round(hoursByBucket.invest * 10) / 10,
        }
      : null;

  // 행동 추천 — "시간 진단"을 실제 다음 행동으로 연결한다 (우선순위 순, 최대 3개).
  const { count: slotCount } = await db
    .from("time_slots")
    .select("id", { count: "exact", head: true })
    .eq("host_id", userId)
    .eq("active", true);

  const actions: TimeAssetSummary["actions"] = [];
  const freeH = Math.round(unrecordedForMsg);

  if (income.incomeType == null) {
    actions.push({
      key: "set-wage",
      title: "내 1시간의 가치부터 정해보세요",
      body: "시급이나 월급을 설정하면 모든 일정이 금액으로 보이고, 시간 분석이 돈 단위로 계산돼요.",
      ctaLabel: "자산 설정 열기",
      target: "asset-settings",
    });
  }

  if ((slotCount ?? 0) === 0) {
    actions.push({
      key: "create-slot",
      title: "남는 시간으로 수익을 만들어 보세요",
      body:
        hourly != null && freeH >= 5
          ? `이번 주 비어있는 시간이 약 ${freeH}시간 — 시급 기준 ₩${Math.round(freeH * hourly).toLocaleString("ko-KR")}어치예요. 커피챗·멘토링·자문 타임슬롯을 열면 그중 일부가 실제 수익이 돼요.`
          : "커피챗·멘토링·자문 타임슬롯을 열면 비어있는 시간이 예약 가능한 상품이 돼요. 가격은 무료부터 경매까지 자유예요.",
      ctaLabel: "타임슬롯 만들기",
      target: "slots",
    });
  } else if (tradedKrw === 0) {
    actions.push({
      key: "share-profile",
      title: "열어둔 타임슬롯을 알려보세요",
      body: "아직 거래가 없어요. 프로필 링크를 SNS나 지인에게 공유하면 예약이 시작돼요. 팔로워에게는 오르빗 탭에도 노출돼요.",
      ctaLabel: "프로필 공유하러 가기",
      target: "profile",
    });
  }

  if (hoursByBucket.invest === 0 && scheduled > 0) {
    actions.push({
      key: "invest-time",
      title: "미래에 투자하는 시간이 이번 주 0시간이에요",
      body:
        hourly != null
          ? `학습·운동·사이드 프로젝트 같은 투자 시간이 내일의 시급을 올려요. 주 2시간이면 1년에 ${Math.round(104)}시간 — 지금 시급 기준 ₩${Math.round(104 * hourly).toLocaleString("ko-KR")}어치의 미래 투자예요.`
          : "학습·운동·사이드 프로젝트 같은 투자 시간이 내일의 시급을 올려요. 학습 캘린더에 한 블록만 넣어볼까요?",
      ctaLabel: "학습 일정 추가",
      target: "calendar",
    });
  }

  if (
    income.incomeType === "freelance" &&
    freelance &&
    freelance.months.length === 0
  ) {
    actions.push({
      key: "record-income",
      title: "이번 달 수입을 기록해 보세요",
      body: "월 수입을 기록하면 실제 데이터로 실효 시급이 계산되고, 시간당 얼마를 벌고 있는지 정확해져요.",
      ctaLabel: "수입 기록하기",
      target: "asset-settings",
    });
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
    actions: actions.slice(0, 3),
    report,
    yearRemaining,
    goals,
    incomeType: income.incomeType,
    freelance,
  };
}
