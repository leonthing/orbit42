import { apiSession, loadApiUser } from "@/lib/api-auth";
import {
  getProfile,
  updateProfile,
  type SocialLinks,
} from "@/lib/auth";
import { getFollowStats } from "@/lib/follows";

export const dynamic = "force-dynamic";

const SOCIAL_KEYS = ["instagram", "x", "youtube", "facebook", "linkedin"] as const;

async function fullUser(username: string) {
  const { getAdminClient } = await import("@/lib/supabase");
  const [user, profile, follows, privacyRow] = await Promise.all([
    loadApiUser(username),
    getProfile(username),
    getFollowStats(username),
    getAdminClient()
      .from("users")
      .select("is_private, apple_sub, share_image_url")
      .eq("username", username)
      .maybeSingle(),
  ]);
  if (!user) return null;
  return {
    ...user,
    bio: (profile?.bio as string | null) ?? null,
    birthDate: (profile?.birth_date as string | null) ?? null,
    socialLinks: (profile?.social_links as SocialLinks | null) ?? {},
    interests: (profile?.interests as string[] | null) ?? [],
    // 오르빗 카운트 — orbiters: 나를 오르빗에 담은 사람, orbiting: 내가 담은 사람
    orbiters: follows.followers,
    orbiting: follows.following,
    // 프로필 비공개: 검색·프로필 조회·오르빗 노출에서 숨김
    isPrivate: Boolean(privacyRow.data?.is_private),
    // Apple 계정 연결 여부 (설정 > 계정)
    appleLinked: privacyRow.data?.apple_sub != null,
    // 프로필 공유(OG) 헤더 이미지 — 없으면 자동 명함 카드
    shareImageUrl: (privacyRow.data?.share_image_url as string | null) ?? null,
  };
}

// GET — Authorization: Bearer <token>
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const user = await fullUser(session.username);
  if (!user) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ user });
}

// PATCH { displayName?, bio?, birthDate?, socialLinks?, interests? }
export async function PATCH(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: {
    displayName?: string;
    bio?: string | null;
    birthDate?: string | null;
    socialLinks?: Record<string, string>;
    interests?: string[];
    isPrivate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // 프로필 비공개 토글은 다른 필드와 독립적으로 처리한다.
  if (body.isPrivate !== undefined) {
    if (typeof body.isPrivate !== "boolean") {
      return Response.json({ error: "isPrivate 값이 올바르지 않아요." }, { status: 400 });
    }
    const { getAdminClient } = await import("@/lib/supabase");
    const { error } = await getAdminClient()
      .from("users")
      .update({ is_private: body.isPrivate, updated_at: new Date().toISOString() })
      .eq("username", session.username);
    if (error) {
      return Response.json({ error: "저장에 실패했어요." }, { status: 400 });
    }
    // isPrivate만 온 경우 바로 응답.
    const onlyPrivacy =
      body.displayName === undefined &&
      body.bio === undefined &&
      body.birthDate === undefined &&
      body.socialLinks === undefined &&
      body.interests === undefined;
    if (onlyPrivacy) {
      return Response.json({ user: await fullUser(session.username) });
    }
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

  let birthDate: string | null | undefined = undefined;
  if (body.birthDate !== undefined) {
    if (body.birthDate === null || body.birthDate === "") {
      birthDate = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.birthDate))) {
      birthDate = String(body.birthDate);
    } else {
      return Response.json(
        { error: "생년월일 형식이 올바르지 않아요. (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
  }

  let socialLinks: SocialLinks | undefined = undefined;
  if (body.socialLinks !== undefined) {
    if (
      typeof body.socialLinks !== "object" ||
      body.socialLinks === null ||
      Array.isArray(body.socialLinks)
    ) {
      return Response.json({ error: "소셜 링크 형식이 올바르지 않아요." }, { status: 400 });
    }
    socialLinks = {};
    for (const key of SOCIAL_KEYS) {
      const v = body.socialLinks[key];
      if (typeof v === "string" && v.trim()) {
        socialLinks[key] = v.trim().slice(0, 200);
      }
    }
  }

  const extra: {
    bio?: string | null;
    interests?: string[];
  } = {};
  if (body.bio !== undefined) {
    extra.bio = body.bio === null ? null : String(body.bio).slice(0, 500);
  }
  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests)) {
      return Response.json({ error: "관심사 형식이 올바르지 않아요." }, { status: 400 });
    }
    extra.interests = body.interests
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  const result = await updateProfile(
    session.username,
    displayName,
    birthDate,
    socialLinks,
    Object.keys(extra).length > 0 ? extra : undefined,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const user = await fullUser(session.username);
  return Response.json({ user });
}
