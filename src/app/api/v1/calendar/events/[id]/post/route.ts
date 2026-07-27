import { apiSession, apiUserId } from "@/lib/api-auth";
import {
  getEventPost,
  upsertEventPost,
  deleteEventPost,
  addEventPostImages,
  type EventPostVisibility,
} from "@/lib/event-posts";

export const dynamic = "force-dynamic";

function toApiPost(post: {
  event_key: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  note: string | null;
  image_urls: string[];
  visibility: string;
}) {
  return {
    eventKey: post.event_key,
    title: post.title,
    startAt: post.start_at,
    endAt: post.end_at,
    allDay: post.all_day,
    note: post.note,
    imageUrls: post.image_urls,
    visibility: post.visibility,
  };
}

const VISIBILITIES = new Set(["private", "followers", "public"]);

// GET — 이 일정의 시간 로그 (없으면 post: null)
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const post = await getEventPost(userId, params.id);
  return Response.json({ post: post ? toApiPost(post) : null });
}

// PUT — 공개 범위 변경 (스냅샷과 함께 생성/갱신)
// { title, startAt, endAt?, allDay?, visibility }
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: {
    title?: string;
    startAt?: string;
    endAt?: string | null;
    allDay?: boolean;
    visibility?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.title || !body.startAt) {
    return Response.json({ error: "일정 정보가 필요해요." }, { status: 400 });
  }
  if (body.visibility !== undefined && !VISIBILITIES.has(body.visibility)) {
    return Response.json({ error: "공개 범위가 올바르지 않아요." }, { status: 400 });
  }

  const result = await upsertEventPost(
    userId,
    params.id,
    {
      title: String(body.title).slice(0, 200),
      start_at: body.startAt,
      end_at: body.endAt ?? null,
      all_day: Boolean(body.allDay),
    },
    body.visibility as EventPostVisibility | undefined,
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ post: toApiPost(result) });
}

// POST — 사진 업로드 (multipart: files[] + title/startAt/endAt/allDay)
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const title = String(form.get("title") ?? "").trim();
  const startAt = String(form.get("startAt") ?? "");
  if (!title || !startAt) {
    return Response.json({ error: "일정 정보가 필요해요." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "사진을 선택해 주세요." }, { status: 400 });
  }

  const result = await addEventPostImages(
    userId,
    params.id,
    {
      title: title.slice(0, 200),
      start_at: startAt,
      end_at: form.get("endAt") ? String(form.get("endAt")) : null,
      all_day: form.get("allDay") === "true",
    },
    files,
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ post: toApiPost(result) });
}

// DELETE ?imageUrl=... — 사진 한 장 제거 / 없으면 기록 전체 삭제
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const imageUrl = new URL(request.url).searchParams.get("imageUrl");
  if (imageUrl) {
    const { removeEventPostImage } = await import("@/lib/event-posts");
    const result = await removeEventPostImage(userId, params.id, imageUrl);
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ post: toApiPost(result) });
  }

  const result = await deleteEventPost(userId, params.id);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, post: null });
}
