import { apiSession, apiUserId } from "@/lib/api-auth";
import { getWorkHours, saveWorkHours } from "@/lib/insights";
import type { WorkHours, WorkDay } from "@/lib/insights-types";

export const dynamic = "force-dynamic";

const DAYS: WorkDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET — 인사이트/자동 슬롯 공용 근무시간 (요일당 1구간)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ workHours: await getWorkHours(userId) });
}

// PUT { workHours: { mon: {start,end}, ... } } — 전체 교체 (끈 요일은 키 제외)
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { workHours?: Record<string, { start?: string; end?: string }> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const raw = body.workHours;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return Response.json({ error: "workHours 형식이 올바르지 않아요." }, { status: 400 });
  }

  const hours: WorkHours = {};
  for (const [day, range] of Object.entries(raw)) {
    if (!DAYS.includes(day as WorkDay)) {
      return Response.json({ error: "요일이 올바르지 않아요." }, { status: 400 });
    }
    const start = range?.start ?? "";
    const end = range?.end ?? "";
    if (!HHMM.test(start) || !HHMM.test(end) || start >= end) {
      return Response.json(
        { error: "시간 형식이 올바르지 않아요. (HH:mm, 시작<종료)" },
        { status: 400 },
      );
    }
    hours[day as WorkDay] = { start, end };
  }

  const saved = await saveWorkHours(userId, hours);
  return Response.json({ workHours: saved });
}
