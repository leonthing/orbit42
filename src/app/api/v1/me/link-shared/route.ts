import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST — 내 예약 링크·링크 페이지 주소를 처음 공유/복사했을 때 (1.6.0 ①).
 * users.first_link_shared_at 이 비어 있을 때만 지금 시각을 적는다(덮어쓰지 않음). 늘 204.
 */
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const userId = await apiUserId(request);
  if (!userId) return new Response(null, { status: 204 });
  const { error } = await getAdminClient()
    .from("users")
    .update({ first_link_shared_at: new Date().toISOString() })
    .eq("id", userId)
    .is("first_link_shared_at", null);
  if (error) console.error("link-shared", error.message);
  return new Response(null, { status: 204 });
}
