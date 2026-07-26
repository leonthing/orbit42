import { apiSession, loadApiUser } from "@/lib/api-auth";

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
  return Response.json({ user });
}
