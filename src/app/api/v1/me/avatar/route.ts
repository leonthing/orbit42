import { apiSession } from "@/lib/api-auth";
import { uploadAvatar, clearAvatar } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST multipart/form-data (field: "avatar") — 프로필 사진 업로드
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const result = await uploadAvatar(formData);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, url: (result as { url?: string }).url });
}

// DELETE — 프로필 사진 제거
export async function DELETE(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await clearAvatar();
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
