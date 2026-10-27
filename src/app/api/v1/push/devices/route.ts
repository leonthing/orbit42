import { apiSession } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * 앱 푸시 기기 토큰 (1.8.0).
 * POST   { token, env: "production"|"sandbox", appVersion } — 알림을 허용한 기기가 등록(같은 토큰이면 지금 계정으로 옮긴다)
 * DELETE { token } — 로그아웃할 때 앱이 지운다(내 계정의 토큰만)
 */
const TOKEN_RE = /^[0-9a-f]{32,200}$/;

async function myUserId(request: Request): Promise<string | null> {
  const session = await apiSession(request);
  if (!session) return null;
  const { data } = await getAdminClient().from("users").select("id").eq("username", session.username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await myUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await readBody(request);
  const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
  const env = body?.env === "sandbox" ? "sandbox" : body?.env === "production" ? "production" : null;
  const appVersion = typeof body?.appVersion === "string" ? body.appVersion.slice(0, 32) : null;
  if (!TOKEN_RE.test(token) || !env) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await getAdminClient()
    .from("push_devices")
    .upsert({ user_id: userId, token, env, app_version: appVersion, last_seen_at: now }, { onConflict: "token" });
  if (error) {
    console.error("[push] register", error.message);
    return Response.json({ error: "등록하지 못했어요." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await myUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await readBody(request);
  const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
  if (!TOKEN_RE.test(token)) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  await getAdminClient().from("push_devices").delete().eq("user_id", userId).eq("token", token);
  return Response.json({ ok: true });
}
