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

  // 차단 관계(양방향)면 요청 불가.
  {
    const { apiUserId } = await import("@/lib/api-auth");
    const { isBlockedEitherWay } = await import("@/lib/blocks");
    const { getAdminClient } = await import("@/lib/supabase");
    const myId = await apiUserId(request);
    const { data: host } = await getAdminClient()
      .from("users")
      .select("id")
      .eq("username", params.username)
      .maybeSingle();
    if (myId && host?.id && (await isBlockedEitherWay(myId, host.id as string))) {
      return Response.json({ error: "요청할 수 없는 상대예요." }, { status: 403 });
    }
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
