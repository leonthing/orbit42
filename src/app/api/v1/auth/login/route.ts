import { getAdminClient } from "@/lib/supabase";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { tokenResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST { identifier: string (username or email), password: string }
export async function POST(request: Request) {
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";
  if (!identifier || !password) {
    return Response.json(
      { error: "아이디(또는 이메일)와 비밀번호를 입력해주세요." },
      { status: 400 },
    );
  }

  const limit = rateLimit(clientKey("api-login", identifier), 8, 5 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const db = getAdminClient();

  let username = identifier;
  if (identifier.includes("@")) {
    const { data } = await db
      .from("users")
      .select("username")
      .ilike("email", identifier.toLowerCase())
      .maybeSingle();
    username = (data?.username as string | undefined) ?? "";
  }

  const invalid = Response.json(
    { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
    { status: 401 },
  );
  if (!username) return invalid;

  const { data: valid, error } = await db.rpc("verify_user", {
    p_username: username,
    p_password: password,
  });
  if (error || !valid) return invalid;

  return tokenResponse(username);
}
