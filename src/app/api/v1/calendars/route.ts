import { apiSession } from "@/lib/api-auth";
import {
  listMyCalendars,
  createNativeCalendar,
  createGoogleLinkedCalendar,
} from "@/lib/calendars";
import {
  toApiCalendar,
  CALENDAR_PURPOSES as PURPOSES,
  CALENDAR_VISIBILITIES as VISIBILITIES,
  HEX_COLOR as HEX,
} from "@/lib/api-calendars";

export const dynamic = "force-dynamic";

// GET — 내 캘린더 목록
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const calendars = await listMyCalendars();
  return Response.json({ calendars: calendars.map(toApiCalendar) });
}

// POST { name, purpose, color, visibility, linkGoogle? } — 새 캘린더.
// linkGoogle=true 면 구글 계정에 실제 캘린더까지 만들어 연결한다.
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: {
    name?: string;
    purpose?: string;
    color?: string;
    visibility?: string;
    linkGoogle?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 50) {
    return Response.json({ error: "이름은 1~50자여야 해요." }, { status: 400 });
  }
  const purpose = (body.purpose ?? "personal") as (typeof PURPOSES)[number];
  if (!PURPOSES.includes(purpose)) {
    return Response.json({ error: "용도가 올바르지 않아요." }, { status: 400 });
  }
  const color = body.color ?? "#6366f1";
  if (!HEX.test(color)) {
    return Response.json({ error: "색상이 올바르지 않아요." }, { status: 400 });
  }
  const visibility = (body.visibility ?? "private") as (typeof VISIBILITIES)[number];
  if (!VISIBILITIES.includes(visibility)) {
    return Response.json({ error: "공개 범위가 올바르지 않아요." }, { status: 400 });
  }

  const args = { name, purpose, color, visibility };
  const result = body.linkGoogle
    ? await createGoogleLinkedCalendar(args)
    : await createNativeCalendar(args);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const calendars = await listMyCalendars();
  return Response.json({ calendars: calendars.map(toApiCalendar) });
}
