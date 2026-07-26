import { apiSession } from "@/lib/api-auth";
import { changePassword } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST { currentPassword, newPassword }
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const limit = rateLimit(
    clientKey("api-password", session.username),
    5,
    10 * 60_000,
  );
  if (!limit.ok) {
    return Response.json(
      { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await changePassword(
    session.username,
    body.currentPassword ?? "",
    body.newPassword ?? "",
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
