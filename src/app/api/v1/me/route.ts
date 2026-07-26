import { apiSession, loadApiUser } from "@/lib/api-auth";
import { getProfile, updateProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — Authorization: Bearer <token>
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const user = await loadApiUser(session.username);
  if (!user) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const profile = await getProfile(session.username);
  return Response.json({
    user: { ...user, bio: (profile?.bio as string | null) ?? null },
  });
}

// PATCH { displayName?, bio? } — 프로필 기본 정보 수정
export async function PATCH(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { displayName?: string; bio?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const current = await getProfile(session.username);
  if (!current) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let displayName = (current.display_name as string | null) ?? session.username;
  if (body.displayName !== undefined) {
    const v = String(body.displayName).trim();
    if (!v || v.length > 50) {
      return Response.json({ error: "이름은 1~50자여야 해요." }, { status: 400 });
    }
    displayName = v;
  }
  const extra =
    body.bio !== undefined
      ? { bio: body.bio === null ? null : String(body.bio).slice(0, 500) }
      : undefined;

  const result = await updateProfile(
    session.username,
    displayName,
    undefined,
    undefined,
    extra,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const user = await loadApiUser(session.username);
  const profile = await getProfile(session.username);
  return Response.json({
    user: { ...user, bio: (profile?.bio as string | null) ?? null },
  });
}
