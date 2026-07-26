import { apiSession } from "@/lib/api-auth";
import {
  listMyCalendars,
  updateCalendar,
  deleteCalendar,
} from "@/lib/calendars";
import {
  toApiCalendar,
  CALENDAR_PURPOSES as PURPOSES,
  CALENDAR_VISIBILITIES as VISIBILITIES,
  HEX_COLOR as HEX,
} from "@/lib/api-calendars";
import type { Calendar } from "@/lib/calendars-types";

export const dynamic = "force-dynamic";

// PATCH { name?, purpose?, color?, visibility? }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const patch: Partial<
    Pick<Calendar, "name" | "purpose" | "color" | "visibility">
  > = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 50) {
      return Response.json({ error: "이름은 1~50자여야 해요." }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.purpose !== undefined) {
    if (!PURPOSES.includes(body.purpose as (typeof PURPOSES)[number])) {
      return Response.json({ error: "용도가 올바르지 않아요." }, { status: 400 });
    }
    patch.purpose = body.purpose as Calendar["purpose"];
  }
  if (body.color !== undefined) {
    if (!HEX.test(String(body.color))) {
      return Response.json({ error: "색상이 올바르지 않아요." }, { status: 400 });
    }
    patch.color = String(body.color);
  }
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility as (typeof VISIBILITIES)[number])) {
      return Response.json({ error: "공개 범위가 올바르지 않아요." }, { status: 400 });
    }
    patch.visibility = body.visibility as Calendar["visibility"];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const result = await updateCalendar(params.id, patch);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const calendars = await listMyCalendars();
  return Response.json({ calendars: calendars.map(toApiCalendar) });
}

// DELETE — 캘린더 삭제 (기본 캘린더는 서버가 거부)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await deleteCalendar(params.id);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const calendars = await listMyCalendars();
  return Response.json({ calendars: calendars.map(toApiCalendar) });
}
