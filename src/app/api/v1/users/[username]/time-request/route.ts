import { apiSession } from "@/lib/api-auth";
import { createTimeRequest } from "@/lib/time-requests";

export const dynamic = "force-dynamic";

// POST { message, durationMin, budgetKrw?, preferredTimes? }
// 슬롯이 없어도 "이런 시간이 필요해요"를 보낼 수 있다 — 호스트가 수락하면 예약으로 전환.
export async function POST(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: {
    message?: string;
    durationMin?: number;
    budgetKrw?: number | null;
    preferredTimes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await createTimeRequest(params.username, {
    message: body.message ?? "",
    duration_min: Number(body.durationMin) || 60,
    budget_cents:
      body.budgetKrw != null ? Math.round(Number(body.budgetKrw) * 100) : null,
    preferred_times: body.preferredTimes?.slice(0, 500) ?? null,
  });
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
