import { apiSession, apiUserId } from "@/lib/api-auth";
import { verifyAppleIdentityToken } from "@/lib/apple-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST { identityToken } — 로그인된 계정에 Apple 계정을 연결한다.
// Apple이 이메일을 안 내려주는 재인증 상태에서도 sub 만으로 연결 가능 —
// 연결 후에는 Apple 로그인이 sub 매칭으로 동작한다.
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { identityToken?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.identityToken) {
    return Response.json({ error: "Apple 토큰이 없어요." }, { status: 400 });
  }

  const identity = await verifyAppleIdentityToken(body.identityToken);
  if (!identity) {
    return Response.json(
      { error: "Apple 인증 검증에 실패했어요. 다시 시도해주세요." },
      { status: 401 },
    );
  }

  const db = getAdminClient();
  // 이 Apple 계정이 다른 orbit42 계정에 이미 연결돼 있으면 거부.
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("apple_sub", identity.sub)
    .maybeSingle();
  if (existing && existing.id !== userId) {
    return Response.json(
      { error: "이 Apple 계정은 이미 다른 계정에 연결돼 있어요." },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("users")
    .update({ apple_sub: identity.sub, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.error("link-apple", error);
    return Response.json({ error: "연결에 실패했어요." }, { status: 400 });
  }
  return Response.json({ ok: true, appleLinked: true });
}

// DELETE — Apple 계정 연결 해제
export async function DELETE(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ apple_sub: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    return Response.json({ error: "해제에 실패했어요." }, { status: 400 });
  }
  return Response.json({ ok: true, appleLinked: false });
}
