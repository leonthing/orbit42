import { apiSession, apiUserId } from "@/lib/api-auth";
import { getSocialStatus } from "@/lib/social";

export const dynamic = "force-dynamic";

// GET — X/페이스북/링크드인 크로스포스팅 연결 상태
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const status = await getSocialStatus(userId);
  return Response.json({
    x: { connected: status.x.connected, name: status.x.username },
    facebook: { connected: status.facebook.connected, name: status.facebook.name },
    linkedin: { connected: status.linkedin.connected, name: status.linkedin.name },
  });
}
