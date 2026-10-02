import { apiUserId } from "@/lib/api-auth";
import { importDeviceEvents, type AttendeeEvent } from "@/lib/people";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — iOS 기기 캘린더(EventKit) 참석자 가져오기.
// { rangeStart, rangeEnd, events: [{ ref, title, startAt, endAt, attendees: [{ email, name }] }] }
// 범위 안의 기존 기기 만남은 지우고 다시 쓴다.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    rangeStart?: string;
    rangeEnd?: string;
    events?: unknown;
  } | null;
  const start = new Date(body?.rangeStart ?? "");
  const end = new Date(body?.rangeEnd ?? "");
  if (!body || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !Array.isArray(body.events)) {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const events: AttendeeEvent[] = [];
  for (const raw of body.events as Array<Record<string, unknown>>) {
    if (typeof raw?.ref !== "string" || typeof raw.startAt !== "string") continue;
    const attendees = Array.isArray(raw.attendees)
      ? (raw.attendees as Array<Record<string, unknown>>)
          .filter((a) => typeof a?.email === "string")
          .map((a) => ({ email: a.email as string, name: typeof a.name === "string" ? a.name : null }))
      : [];
    events.push({
      ref: `dev_${raw.ref}`.slice(0, 300),
      title: typeof raw.title === "string" ? raw.title : null,
      startAt: raw.startAt,
      endAt: typeof raw.endAt === "string" ? raw.endAt : null,
      attendees,
    });
  }
  try {
    await importDeviceEvents(userId, start, end, events);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
