import { signup } from "@/lib/auth";
import { tokenResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST { username, password, email, displayName? }
export async function POST(request: Request) {
  let body: {
    username?: string;
    password?: string;
    email?: string;
    displayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // Reuses the web signup flow (validation, rate limit, default calendar,
  // verification email, referral seeding). The session cookie it sets is
  // irrelevant to native clients; the bearer token below is what they keep.
  const result = await signup(
    (body.username ?? "").trim().toLowerCase(),
    body.password ?? "",
    body.email ?? "",
    body.displayName?.trim() || undefined,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  if (!("success" in result) || !result.success) {
    return Response.json({ error: "회원가입에 실패했습니다." }, { status: 400 });
  }
  return tokenResponse(result.username, true);
}
