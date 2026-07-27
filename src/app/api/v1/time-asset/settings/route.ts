import { apiSession, apiUserId } from "@/lib/api-auth";
import {
  getIncomeSettings,
  saveIncomeSettings,
  saveBucketMap,
  saveSleepHours,
  listIncomeEntries,
  MONTHLY_WORK_HOURS,
  BUCKET_KEYS,
  BUCKET_META,
  DEFAULT_BUCKET_MAP,
  type IncomeType,
  type BucketKey,
} from "@/lib/time-asset";
import { PURPOSE_OPTIONS } from "@/lib/calendar-settings-types";
import type { CalendarPurpose } from "@/lib/calendar-settings-types";

export const dynamic = "force-dynamic";

async function settingsPayload(userId: string) {
  const [settings, incomeEntries] = await Promise.all([
    getIncomeSettings(userId),
    listIncomeEntries(userId),
  ]);
  return {
    ...settings,
    incomeEntries,
    monthlyWorkHours: MONTHLY_WORK_HOURS,
    // iOS 분류 설정 화면용 메타: 용도 한국어 라벨 + 버킷 선택지 + 기본 매핑
    purposes: PURPOSE_OPTIONS.map((p) => ({
      key: p.value,
      label: p.label,
      defaultBucket: DEFAULT_BUCKET_MAP[p.value],
    })),
    bucketOptions: BUCKET_KEYS.map((key) => ({
      key,
      label: BUCKET_META[key].label,
      color: BUCKET_META[key].color,
    })),
  };
}

// GET — 급여 기준 + 유효 버킷 매핑 + 분류 설정 메타
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json(await settingsPayload(userId));
}

// PUT { incomeType?+amount?, bucketMap?: {purpose: bucket ×9} } — 부분 갱신
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: {
    incomeType?: string;
    amount?: number;
    bucketMap?: Record<string, string>;
    sleepHoursPerDay?: number;
    weeklyEarnGoalKrw?: number | null;
    weeklyInvestGoalHours?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const hasIncome = body.incomeType !== undefined || body.amount !== undefined;
  if (hasIncome) {
    if (!["monthly", "hourly", "freelance"].includes(body.incomeType ?? "")) {
      return Response.json({ error: "급여 유형이 올바르지 않아요." }, { status: 400 });
    }
    let amount: number | null = null;
    if (body.incomeType !== "freelance") {
      amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000_000) {
        return Response.json({ error: "금액이 올바르지 않아요." }, { status: 400 });
      }
    }
    const result = await saveIncomeSettings(
      userId,
      body.incomeType as IncomeType,
      amount,
    );
    if ("error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  if (body.bucketMap !== undefined) {
    if (
      typeof body.bucketMap !== "object" ||
      body.bucketMap === null ||
      Array.isArray(body.bucketMap)
    ) {
      return Response.json({ error: "분류 설정이 올바르지 않아요." }, { status: 400 });
    }
    const overrides: Partial<Record<CalendarPurpose, BucketKey>> = {};
    for (const [purpose, bucket] of Object.entries(body.bucketMap)) {
      if (!(purpose in DEFAULT_BUCKET_MAP)) {
        return Response.json({ error: "알 수 없는 용도예요." }, { status: 400 });
      }
      if (!BUCKET_KEYS.includes(bucket as BucketKey)) {
        return Response.json({ error: "알 수 없는 버킷이에요." }, { status: 400 });
      }
      overrides[purpose as CalendarPurpose] = bucket as BucketKey;
    }
    const result = await saveBucketMap(userId, overrides);
    if ("error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  if (body.sleepHoursPerDay !== undefined) {
    const v = Number(body.sleepHoursPerDay);
    if (!Number.isFinite(v) || v < 0 || v > 14) {
      return Response.json(
        { error: "수면 시간은 0~14시간 사이여야 해요." },
        { status: 400 },
      );
    }
    const result = await saveSleepHours(userId, Math.round(v * 2) / 2);
    if ("error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  const hasGoals =
    body.weeklyEarnGoalKrw !== undefined ||
    body.weeklyInvestGoalHours !== undefined;
  if (hasGoals) {
    const validate = (v: unknown, max: number): number | null | false => {
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= max ? n : false;
    };
    const earn =
      body.weeklyEarnGoalKrw !== undefined
        ? validate(body.weeklyEarnGoalKrw, 10_000_000_000)
        : undefined;
    const invest =
      body.weeklyInvestGoalHours !== undefined
        ? validate(body.weeklyInvestGoalHours, 100)
        : undefined;
    if (earn === false || invest === false) {
      return Response.json({ error: "목표 값이 올바르지 않아요." }, { status: 400 });
    }
    const { saveWeeklyGoals } = await import("@/lib/time-asset");
    const result = await saveWeeklyGoals(userId, {
      earnKrw: earn,
      investHours: invest,
    });
    if ("error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  if (
    !hasIncome &&
    body.bucketMap === undefined &&
    body.sleepHoursPerDay === undefined &&
    !hasGoals
  ) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  return Response.json(await settingsPayload(userId));
}
