import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COLUMNS: Record<string, Record<string, null>> = {
  x: {
    x_access_token: null,
    x_refresh_token: null,
    x_token_expiry: null,
    x_username: null,
  },
  facebook: {
    fb_page_id: null,
    fb_page_token: null,
    fb_user_name: null,
  },
  linkedin: {
    linkedin_access_token: null,
    linkedin_refresh_token: null,
    linkedin_token_expiry: null,
    linkedin_sub: null,
    linkedin_name: null,
  },
};

// POST { provider: "x"|"facebook"|"linkedin" } — 크로스포스팅 연결 해제
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const cols = COLUMNS[body.provider ?? ""];
  if (!cols) {
    return Response.json({ error: "알 수 없는 서비스예요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ ...cols, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.error("social disconnect", error);
    return Response.json({ error: "해제에 실패했어요." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
