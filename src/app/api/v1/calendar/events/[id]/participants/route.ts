import { apiSession, apiUserId } from "@/lib/api-auth";
import { canReceiveEmail } from "@/lib/email-deliverable";
import {
  listParticipants,
  addParticipantByUsername,
  addParticipantByEmail,
  removeParticipant,
} from "@/lib/event-participants";
import {
  addGoogleAttendees,
  attendeeUsersByEmail,
  toApiAttendees,
} from "@/lib/calendar-events";
import { getAdminClient } from "@/lib/supabase";

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

type Invitee = { username?: string; email?: string };

/** 태그한 Orbit42 사용자는 그 사람의 이메일로 바꾼다 (구글 초대용). */
async function resolveEmails(
  userId: string,
  invitees: Invitee[],
): Promise<{ emails: string[] } | { error: string }> {
  const emails: string[] = [];
  const db = getAdminClient();
  for (const invitee of invitees) {
    if (invitee.username) {
      const { data } = await db
        .from("users")
        .select("id, email")
        .eq("username", invitee.username.trim().toLowerCase())
        .maybeSingle();
      if (!data) return { error: "사용자를 찾을 수 없어요." };
      if (data.id === userId) return { error: "나 자신은 추가할 수 없어요." };
      const { isBlockedEitherWay } = await import("@/lib/blocks");
      if (await isBlockedEitherWay(userId, data.id as string)) {
        return { error: "초대할 수 없는 상대예요." };
      }
      if (!data.email) {
        return { error: "이메일이 없는 사용자라 구글 초대를 보낼 수 없어요." };
      }
      if (!canReceiveEmail(data.email as string)) {
        return { error: "메일을 받을 수 없는 계정이라 구글 초대를 보낼 수 없어요." };
      }
      emails.push(data.email as string);
    } else if (invitee.email) {
      const email = invitee.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "이메일 형식이 올바르지 않아요." };
      }
      if (!canReceiveEmail(email)) {
        return { error: "메일을 받을 수 없는 주소라 구글 초대를 보낼 수 없어요." };
      }
      emails.push(email);
    }
  }
  if (emails.length === 0) return { error: "username 또는 email이 필요해요." };
  return { emails };
}

// POST { username? | email?, title, startAt, endAt?, allDay? } — 태그/초대
// 구글 일정(gcal_*) + googleInvite: true 는 { username? | email? | invitees?, calendarId? } —
// 구글 이벤트에 attendee 로 넣고 구글이 초대 메일을 보낸다. Orbit42 자체 메일·참석자 행은
// 만들지 않는다. googleInvite 는 확인 단계를 거친 클라이언트(앱 1.4.1+)만 보낸다 — 옛 앱은
// 확인 없이 구글 메일이 나가지 않도록 예전처럼 처리한다.
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
    calendarId?: string | null;
    invitees?: Invitee[];
    googleInvite?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (params.id.startsWith("gcal_") && body.googleInvite === true) {
    const invitees: Invitee[] = Array.isArray(body.invitees)
      ? body.invitees.slice(0, 50)
      : [{ username: body.username, email: body.email }];
    const resolved = await resolveEmails(userId, invitees);
    if ("error" in resolved) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }
    const result = await addGoogleAttendees(
      userId,
      params.id,
      body.calendarId ?? null,
      resolved.emails,
    );
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    const users = await attendeeUsersByEmail(result.attendees.map((a) => a.email));
    return Response.json({
      participants: await listParticipants(userId, params.id),
      attendees: toApiAttendees(result.attendees, users) ?? [],
    });
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
