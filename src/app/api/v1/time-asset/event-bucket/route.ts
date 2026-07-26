import { apiSession, apiUserId } from "@/lib/api-auth";
import { setEventBucket, BUCKET_KEYS, type BucketKey } from "@/lib/time-asset";

export const dynamic = "force-dynamic";

// PUT { eventId, bucket: "earn"|"invest"|"spend"|"life"|null }
// 개별 이벤트의 자산 분류 지정. null 이면 캘린더 용도 기본값으로 복귀.
// eventId 는 로컬 이벤트 uuid 또는 "gcal_..." 문자열.
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { eventId?: string; bucket?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const eventId = (body.eventId ?? "").trim();
  if (!eventId || eventId.length > 300) {
    return Response.json({ error: "eventId가 필요해요." }, { status: 400 });
  }
  if (body.bucket !== null && !BUCKET_KEYS.includes(body.bucket as BucketKey)) {
    return Response.json({ error: "알 수 없는 버킷이에요." }, { status: 400 });
  }

  const result = await setEventBucket(
    userId,
    eventId,
    (body.bucket as BucketKey | null) ?? null,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
