import { apiSession, loadApiUser } from "@/lib/api-auth";
import {
  getProfile,
  updateProfile,
  type SocialLinks,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const SOCIAL_KEYS = ["instagram", "x", "youtube", "facebook", "linkedin"] as const;

async function fullUser(username: string) {
  const [user, profile] = await Promise.all([
    loadApiUser(username),
    getProfile(username),
  ]);
  if (!user) return null;
  return {
    ...user,
    bio: (profile?.bio as string | null) ?? null,
    birthDate: (profile?.birth_date as string | null) ?? null,
    socialLinks: (profile?.social_links as SocialLinks | null) ?? {},
    interests: (profile?.interests as string[] | null) ?? [],
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
  };
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
