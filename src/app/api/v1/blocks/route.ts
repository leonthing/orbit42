import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — 내가 차단한 사용자 목록 (설정 > 차단 관리)
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
  const { data } = await db
    .from("user_blocks")
    .select("blocked:users!user_blocks_blocked_id_fkey(username, display_name, avatar_url)")
    .eq("blocker_id", userId);

  return Response.json({
    users: (data ?? [])
      .map((row) => row.blocked as unknown as {
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      } | null)
      .filter(Boolean)
      .map((u) => ({
        username: u!.username,
        displayName: u!.display_name,
        avatarUrl: u!.avatar_url,
      })),
  });
}
