import { apiUserId } from "@/lib/api-auth";
import { parseImportance, upsertAnnotation, IMPORTANCE_NAMES } from "@/lib/event-annotations";

export const dynamic = "force-dynamic";

// PUT { importance?: "low"|"normal"|"high", rating?: 1..5|null, ratingNote?: string|null, reminderMinutes?: null|-1|0|5|10|30|60,
//     — 내 일정의 중요도·별점 (본인만, 구글에는 쓰지 않음, 일정 제목·시각은 저장하지 않음)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const patch: Parameters<typeof upsertAnnotation>[2] = {};
  if (body.importance !== undefined) {
    const imp = parseImportance(body.importance);
    if (imp === null) return Response.json({ error: "importance 는 low·normal·high 중 하나예요." }, { status: 400 });
    patch.importance = imp;
  }
  if (body.rating !== undefined) {
    if (body.rating === null) patch.rating = null;
    else if (Number.isInteger(body.rating) && (body.rating as number) >= 1 && (body.rating as number) <= 5) {
      patch.rating = body.rating as number;
    } else return Response.json({ error: "rating 은 1~5 또는 null 이에요." }, { status: 400 });
  }
  if (body.ratingNote !== undefined) {
    if (body.ratingNote !== null && typeof body.ratingNote !== "string") {
      return Response.json({ error: "ratingNote 는 글자예요." }, { status: 400 });
    }
    patch.ratingNote = (body.ratingNote as string | null)?.trim().slice(0, 500) ?? null;
  }
  if (body.reminderMinutes !== undefined) {
    // 화면 선택지와 같은 값만 받는다: null(기본값) · -1(없음) · 0(정각) · 5 · 10 · 30 · 60
    const allowed = [-1, 0, 5, 10, 30, 60];
    if (body.reminderMinutes !== null && !allowed.includes(body.reminderMinutes as number)) {
      return Response.json({ error: "reminderMinutes 는 null·-1·0·5·10·30·60 중 하나예요." }, { status: 400 });
    }
    patch.reminderMinutes = body.reminderMinutes as number | null;
  }
  if (body.remindAt !== undefined) {
    // 다시 알림 — 지금 이후만, 1년 안쪽. null 은 취소.
    if (body.remindAt === null) patch.remindAt = null;
    else {
      const t = typeof body.remindAt === "string" ? Date.parse(body.remindAt) : NaN;
      if (Number.isNaN(t) || t <= Date.now() || t > Date.now() + 366 * 86_400_000) {
        return Response.json({ error: "remindAt 은 지금 이후 1년 안의 시각이에요." }, { status: 400 });
      }
      patch.remindAt = new Date(t).toISOString();
    }
  }
  if (patch.importance === undefined && patch.rating === undefined && patch.ratingNote === undefined && patch.reminderMinutes === undefined && patch.remindAt === undefined) {
    return Response.json({ error: "바꿀 내용이 없어요." }, { status: 400 });
  }
  try {
    const a = await upsertAnnotation(userId, params.id, patch);
    return Response.json({
      ok: true,
      importance: IMPORTANCE_NAMES[a.importance],
      rating: a.rating,
      ratingNote: a.ratingNote,
      reminderMinutes: a.reminderMinutes,
      remindAt: a.remindAt,
    });
  } catch {
    return Response.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
