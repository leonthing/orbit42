import { getAdminClient } from "@/lib/supabase";
import { getUserId } from "@/lib/db";
import { recordFunnel } from "@/lib/funnel";

export const dynamic = "force-dynamic";

/**
 * POST — 방문 흐름 단계 기록 (개선-32). 화면에서만 알 수 있는 단계만 받는다.
 * { slotId, step: "slot_view" | "time_picked", source?: "web" | "ios" }
 * 또는 { hostUsername, step: "profile_view", source } (링크 페이지·앱의 사람 프로필 열람).
 * 로그인 없이도 받는다(방문자). 사람을 알아볼 값은 저장하지 않고 횟수만 +1.
 * 늘 204 — 기록 실패가 화면에 영향을 주지 않게.
 */
export async function POST(request: Request) {
  let body: { slotId?: string; hostUsername?: string; step?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const source = body.source === "ios" ? "ios" : "web";
  const step = body.step;
  const db = getAdminClient();
  const viewerId = await getUserId().catch(() => null);
  const userAgent = request.headers.get("user-agent");

  if ((step === "slot_view" || step === "time_picked") && body.slotId) {
    const { data: slot } = await db
      .from("time_slots")
      .select("id, host_id, active")
      .eq("id", body.slotId)
      .maybeSingle();
    if (slot?.active) {
      recordFunnel({ hostId: slot.host_id as string, slotId: slot.id as string, step, source, viewerId, userAgent });
    }
  } else if (step === "profile_view" && body.hostUsername) {
    const { data: host } = await db
      .from("users")
      .select("id")
      .eq("username", body.hostUsername)
      .maybeSingle();
    if (host) recordFunnel({ hostId: host.id as string, step, source, viewerId, userAgent });
  }
  return new Response(null, { status: 204 });
}
