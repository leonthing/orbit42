import { apiSession, apiUserId } from "@/lib/api-auth";
import {
  listParticipants,
  addParticipantByUsername,
  addParticipantByEmail,
  removeParticipant,
} from "@/lib/event-participants";

export const dynamic = "force-dynamic";

async function requireUser(request: Request) {
  const session = await apiSession(request);
  if (!session) return null;
  return apiUserId(request);
}

// GET — 이 일정의 참석자 목록 (소유자 시점)
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  return Response.json({
    participants: await listParticipants(userId, params.id),
  });
}

// POST { username? | email?, title, startAt, endAt?, allDay? } — 태그/초대
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: {
    username?: string;
    email?: string;
    title?: string;
    startAt?: string;
    endAt?: string | null;
    allDay?: boolean;
    location?: string | null;
    description?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.title || !body.startAt) {
    return Response.json({ error: "일정 정보가 필요해요." }, { status: 400 });
  }
  const snapshot = {
    title: String(body.title).slice(0, 200),
    start_at: body.startAt,
    end_at: body.endAt ?? null,
    all_day: Boolean(body.allDay),
    // 장소·메모는 저장하지 않고 초대 메일에만 실린다.
    location: body.location ? String(body.location).slice(0, 200) : null,
    description: body.description
      ? String(body.description).slice(0, 1000)
      : null,
  };

  const result = body.username
    ? await addParticipantByUsername(userId, params.id, snapshot, body.username)
    : body.email
      ? await addParticipantByEmail(userId, params.id, snapshot, body.email)
      : { error: "username 또는 email이 필요해요." };
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({
    participants: await listParticipants(userId, params.id),
  });
}

// DELETE ?participantId=<rowId> — 참석자 제거
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const participantId = new URL(request.url).searchParams.get("participantId");
  if (!participantId) {
    return Response.json({ error: "participantId가 필요해요." }, { status: 400 });
  }
  const result = await removeParticipant(userId, params.id, participantId);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({
    participants: await listParticipants(userId, params.id),
  });
}
