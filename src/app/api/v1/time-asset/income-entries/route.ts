import { apiSession, apiUserId } from "@/lib/api-auth";
import {
  listIncomeEntries,
  upsertIncomeEntry,
  deleteIncomeEntry,
} from "@/lib/time-asset";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// PUT { month: "YYYY-MM", amountKrw: 원 } — 월 수입 기록 (프리랜서 모드)
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { month?: string; amountKrw?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!MONTH_RE.test(body.month ?? "")) {
    return Response.json({ error: "월 형식이 올바르지 않아요. (YYYY-MM)" }, { status: 400 });
  }
  const amount = Number(body.amountKrw);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000_000) {
    return Response.json({ error: "금액이 올바르지 않아요." }, { status: 400 });
  }

  const result = await upsertIncomeEntry(userId, body.month as string, amount);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ entries: await listIncomeEntries(userId) });
}

// DELETE ?month=YYYY-MM — 월 수입 기록 삭제
export async function DELETE(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) {
    return Response.json({ error: "월 형식이 올바르지 않아요." }, { status: 400 });
  }
  const result = await deleteIncomeEntry(userId, month);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ entries: await listIncomeEntries(userId) });
}
