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
    Pick<
      Calendar,
      | "name" | "purpose" | "color" | "visibility" | "hourly_rate_krw"
      | "goal_title" | "goal_target_hours" | "goal_deadline"
      | "goal_started_at" | "archived_at"
    >
  > = {};

  // ── 목표 캘린더 ──
  if (body.goalTitle !== undefined) {
    const title = body.goalTitle === null ? "" : String(body.goalTitle).trim();
    patch.goal_title = title ? title.slice(0, 100) : null;
    // 목표를 새로 붙이면 그 시점부터 집계 시작, 해제하면 시작점도 비운다.
    patch.goal_started_at = title ? new Date().toISOString() : null;
  }
  if (body.goalTargetHours !== undefined) {
    if (body.goalTargetHours === null) {
      patch.goal_target_hours = null;
    } else {
      const v = Number(body.goalTargetHours);
      if (!Number.isFinite(v) || v <= 0 || v > 100_000) {
        return Response.json({ error: "목표 시간이 올바르지 않아요." }, { status: 400 });
      }
      patch.goal_target_hours = v;
    }
  }
  if (body.goalDeadline !== undefined) {
    if (body.goalDeadline === null || body.goalDeadline === "") {
      patch.goal_deadline = null;
    } else {
      const d = String(body.goalDeadline);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return Response.json({ error: "목표 기한이 올바르지 않아요." }, { status: 400 });
      }
      patch.goal_deadline = d;
    }
  }
  if (body.archived !== undefined) {
    patch.archived_at = body.archived ? new Date().toISOString() : null;
  }
  if (body.hourlyRateKrw !== undefined) {
    if (body.hourlyRateKrw === null) {
      patch.hourly_rate_krw = null;
    } else {
      const v = Number(body.hourlyRateKrw);
      if (!Number.isInteger(v) || v <= 0 || v > 100_000_000) {
        return Response.json({ error: "단가가 올바르지 않아요." }, { status: 400 });
      }
      patch.hourly_rate_krw = v;
    }
  }
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
