import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { listExtraGoogleAccounts } from "@/lib/google";

export const dynamic = "force-dynamic";

// GET — 구글 캘린더 연결 상태 + 추가 계정 목록
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const db = getAdminClient();
  const [{ data: user }, extras] = await Promise.all([
    db.from("users").select("google_refresh_token").eq("id", userId).single(),
    listExtraGoogleAccounts(userId),
  ]);

  return Response.json({
    connected: Boolean(user?.google_refresh_token),
    extraAccounts: extras.map((a) => ({ email: a.email })),
  });
}
