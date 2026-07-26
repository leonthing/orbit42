import { apiSession, apiUserId } from "@/lib/api-auth";
import {
  getIncomeSettings,
  saveIncomeSettings,
  MONTHLY_WORK_HOURS,
  type IncomeType,
} from "@/lib/time-asset";

export const dynamic = "force-dynamic";

// GET — 급여 기준 설정 + 환산 시급
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const settings = await getIncomeSettings(userId);
  return Response.json({ ...settings, monthlyWorkHours: MONTHLY_WORK_HOURS });
}

// PUT { incomeType: "monthly"|"hourly", amount: 원 }
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { incomeType?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (body.incomeType !== "monthly" && body.incomeType !== "hourly") {
    return Response.json({ error: "급여 유형이 올바르지 않아요." }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000_000) {
    return Response.json({ error: "금액이 올바르지 않아요." }, { status: 400 });
  }

  const result = await saveIncomeSettings(
    userId,
    body.incomeType as IncomeType,
    amount,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const settings = await getIncomeSettings(userId);
  return Response.json({ ...settings, monthlyWorkHours: MONTHLY_WORK_HOURS });
}
