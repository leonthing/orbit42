import { apiSession } from "@/lib/api-auth";
import { deleteMyAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

// DELETE — 계정 영구 삭제 (App Store 심사 요건: 인앱 탈퇴)
export async function DELETE(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await deleteMyAccount();
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
