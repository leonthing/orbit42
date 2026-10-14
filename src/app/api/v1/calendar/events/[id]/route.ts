import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import {
  updateEvent,
  deleteEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  type EventInput,
} from "@/app/[username]/calendar/actions";

import { parseOccurrenceId } from "@/lib/recurrence";
import {
  normalizeRRule,
  patchNativeOccurrence,
  patchNativeSeries,
  splitNativeSeries,
  deleteNativeOccurrence,
  deleteNativeFollowing,
  deleteNativeSeries,
  patchGoogleSeries,
  deleteGoogleSeries,
  type Scope,
  type SeriesPatch,
} from "@/lib/recurrence-write";

export const dynamic = "force-dynamic";

/** 구글 반복 회차 id (<id>_20261020T010000Z / <id>_20261020) */
const GOOGLE_INSTANCE = /_\d{8}(T\d{6}Z)?$/;
const FOLLOWING_GOOGLE = "구글 일정의 '이후 모두'는 구글 캘린더 앱에서 해 주세요.";

function parseScope(raw: unknown): Scope | null {
  return raw === "this" || raw === "following" || raw === "all" ? raw : null;
}

function toSeriesPatch(patch: Partial<EventInput>): SeriesPatch {
  return {
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.description !== undefined && { description: patch.description ?? null }),
    ...(patch.location !== undefined && { location: patch.location ?? null }),
    ...(patch.location_lat !== undefined && { location_lat: patch.location_lat ?? null }),
    ...(patch.location_lng !== undefined && { location_lng: patch.location_lng ?? null }),
    ...(patch.travel_min !== undefined && { travel_min: patch.travel_min ?? null }),
    ...(patch.start_at !== undefined && { start_at: patch.start_at }),
    ...(patch.end_at !== undefined && { end_at: patch.end_at }),
    ...(patch.all_day !== undefined && { all_day: patch.all_day }),
  };
}

/** `gcal_` 접두 이벤트의 실제 Google 캘린더 ID를 (본인 소유 검증 포함) 해석. */
async function resolveGoogleCalendarId(
  userId: string,
  nativeCalendarId: string | null,
): Promise<string | null> {
  const db = getAdminClient();
  if (nativeCalendarId) {
    const { data } = await db
      .from("calendars")
      .select("google_calendar_id")
      .eq("id", nativeCalendarId)
      .eq("user_id", userId)
      .eq("source", "google")
      .maybeSingle();
    return (data?.google_calendar_id as string | null) ?? null;
  }
  // 연결된 구글 캘린더가 하나뿐이면 그걸로, 아니면 primary.
  const { data: cals } = await db
    .from("calendars")
    .select("google_calendar_id")
    .eq("user_id", userId)
    .eq("source", "google");
  const ids = (cals ?? [])
    .map((c) => c.google_calendar_id as string | null)
    .filter(Boolean) as string[];
  if (ids.length === 1) return ids[0];
  return "primary";
}

function buildEventPatch(body: Record<string, unknown>): Partial<EventInput> {
  const patch: Partial<EventInput> = {};
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.description !== undefined) {
    patch.description =
      body.description === null ? null : String(body.description).slice(0, 2000);
  }
  if (body.startAt !== undefined) patch.start_at = String(body.startAt);
  if (body.endAt !== undefined) patch.end_at = String(body.endAt);
  if (body.allDay !== undefined) patch.all_day = Boolean(body.allDay);
  // 위치: 빈 문자열/null 은 해제. 좌표는 위치 텍스트와 함께 온 값만 신뢰한다.
  if (body.location !== undefined) {
    const text = body.location === null ? "" : String(body.location).trim();
    patch.location = text ? text.slice(0, 300) : null;
    patch.location_lat =
      text && typeof body.locationLat === "number" && Number.isFinite(body.locationLat)
        ? body.locationLat
        : null;
    patch.location_lng =
      text && typeof body.locationLng === "number" && Number.isFinite(body.locationLng)
        ? body.locationLng
        : null;
  }
  if (body.travelMin !== undefined) {
    const v = Number(body.travelMin);
    patch.travel_min =
      Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 480) : null;
  }
  return patch;
}

// PATCH { title?, description?, startAt?, endAt?, allDay?, calendarId?, sourceCalendarId? }
// 로컬 이벤트는 DB 수정, gcal_* 이벤트는 Google Calendar API로 패치.
// calendarId 는 캘린더 이동 대상 — 로컬↔로컬/로컬↔구글/구글(같은 계정)간 이동 지원.
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

  const patch = buildEventPatch(body);
  // 반복: rrule(문자열=바꾸기, null=반복 끄기), isAnniversary, scope(this/following/all)
  let rrule: string | null | undefined;
  if (body.rrule === null || body.rrule === "") rrule = null;
  else if (body.rrule !== undefined) {
    rrule = normalizeRRule(body.rrule);
    if (!rrule) {
      return Response.json({ error: "반복 규칙이 올바르지 않아요." }, { status: 400 });
    }
  }
  const scope = parseScope(body.scope);
  const recurrenceChange = rrule !== undefined || body.isAnniversary !== undefined;

  // 캘린더 이동 판단.
  // - calendarId: 옮길 "대상" 캘린더 (변경 시에만 전송)
  // - sourceCalendarId: gcal_* 이벤트의 현재 소속 native uuid (해석용)
  // - 구버전 호환: gcal_* 이벤트가 sourceCalendarId 없이 calendarId 만 보내면
  //   이동이 아니라 기존처럼 "현재 소속" 해석용으로 취급한다.
  const isGoogleEvent = params.id.startsWith("gcal_");
  const targetId =
    body.calendarId !== undefined ? String(body.calendarId) : undefined;
  const sourceId =
    body.sourceCalendarId !== undefined
      ? String(body.sourceCalendarId)
      : undefined;
  const wantsMove =
    targetId !== undefined &&
    (!isGoogleEvent || (sourceId !== undefined && targetId !== sourceId));

  if (!wantsMove && Object.keys(patch).length === 0 && !recurrenceChange) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }
  if (patch.title !== undefined && !patch.title) {
    return Response.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }
  const hasStart = patch.start_at !== undefined;
  const hasEnd = patch.end_at !== undefined;
  if (hasStart !== hasEnd) {
    return Response.json(
      { error: "시작/종료 시각은 함께 보내야 해요." },
      { status: 400 },
    );
  }
  if (hasStart && hasEnd) {
    const s = Date.parse(patch.start_at as string);
    const e = Date.parse(patch.end_at as string);
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) {
      return Response.json(
        { error: "시작/종료 시각이 올바르지 않아요." },
        { status: 400 },
      );
    }
  }

  try {
    if (wantsMove) {
      const userId = await apiUserId(request);
      if (!userId) {
        return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
      }
      const { moveEventToCalendar } = await import("@/lib/calendar-events");
      const result = await moveEventToCalendar(
        userId,
        params.id,
        targetId as string,
        sourceId ?? null,
        patch,
        body.notifyAttendees === true,
      );
      if ("error" in result) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      // 이동과 함께 온 수정 사항을 참석자 스냅샷에도 반영 (키는 이미 옮겨졌다).
      const { syncParticipantSnapshots } = await import(
        "@/lib/event-participants"
      );
      await syncParticipantSnapshots(userId, result.newId, {
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.start_at !== undefined && { start_at: patch.start_at }),
        ...(patch.end_at !== undefined && { end_at: patch.end_at }),
        ...(patch.all_day !== undefined && { all_day: patch.all_day }),
        ...(patch.location !== undefined && { location: patch.location ?? null }),
        ...(patch.description !== undefined && {
          description: patch.description ?? null,
        }),
      });
      return Response.json({ ok: true, id: result.newId });
    }

    const seriesPatch: SeriesPatch = {
      ...toSeriesPatch(patch),
      ...(rrule !== undefined && { rrule }),
      ...(body.isAnniversary !== undefined && {
        is_anniversary: Boolean(body.isAnniversary) && !!rrule && /FREQ=YEARLY/.test(rrule ?? ""),
      }),
    };

    // ── 반복: Orbit42 회차 / 시리즈 ──
    const occ = isGoogleEvent ? null : parseOccurrenceId(params.id);
    if (!isGoogleEvent && (occ || recurrenceChange)) {
      const userId = await apiUserId(request);
      if (!userId) {
        return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
      }
      // 회차 id 에 범위가 없으면 '이 일정만' (범위를 모르는 1.5.0 앱의 끌어 옮기기)
      const s = occ ? scope ?? (recurrenceChange ? "all" : "this") : "all";
      if (occ && s === "this") {
        if (recurrenceChange) {
          return Response.json({ error: "반복 규칙은 '모두'나 '이후 모두'로 바꿔 주세요." }, { status: 400 });
        }
        await patchNativeOccurrence(userId, params.id, seriesPatch);
        return Response.json({ ok: true, id: params.id });
      }
      if (occ && s === "following") {
        const newId = await splitNativeSeries(userId, params.id, seriesPatch);
        return Response.json({ ok: true, id: newId });
      }
      await patchNativeSeries(userId, occ?.seriesId ?? params.id, seriesPatch, occ?.originalStart ?? null);
      return Response.json({ ok: true, id: params.id });
    }

    if (isGoogleEvent) {
      const userId = await apiUserId(request);
      if (!userId) {
        return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
      }
      const gcalId = await resolveGoogleCalendarId(
        userId,
        sourceId ?? targetId ?? null,
      );
      if (!gcalId) {
        return Response.json(
          { error: "Google 캘린더를 찾을 수 없어요." },
          { status: 400 },
        );
      }
      // ── 반복: 구글 시리즈 전체(master) ──
      const isInstance = GOOGLE_INSTANCE.test(params.id);
      if (scope === "following") {
        return Response.json({ error: FOLLOWING_GOOGLE }, { status: 400 });
      }
      if ((isInstance && scope === "all") || recurrenceChange) {
        const { getAuthenticatedCalendar } = await import("@/lib/google");
        const cal = await getAuthenticatedCalendar(userId);
        if (!cal) {
          return Response.json({ error: "Google 캘린더 연결이 필요해요." }, { status: 400 });
        }
        await patchGoogleSeries(cal, gcalId, params.id.slice("gcal_".length), seriesPatch, body.notifyAttendees === true);
        return Response.json({ ok: true });
      }
      const result = await updateGoogleEvent(
        gcalId,
        params.id.slice("gcal_".length),
        patch,
        body.notifyAttendees === true,
      );
      if ("error" in result) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true });
    }

    await updateEvent(params.id, patch);
    return Response.json({ ok: true });
  } catch (err) {
    // updateEvent 는 Supabase 내부 메시지를 그대로 던지므로 노출하지 않는다.
    console.error("api event patch", err);
    return Response.json(
      { error: "일정을 수정하지 못했어요. 이미 삭제된 일정일 수 있어요." },
      { status: 400 },
    );
  }
}

// DELETE ?calendarId=<native-uuid>  (gcal_* 이벤트 삭제 시 대상 캘린더 해석용)
//        &scope=this|following|all     (반복 회차 — 없으면 '이 일정만')
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const scope = parseScope(new URL(request.url).searchParams.get("scope"));
  try {
    const occ = params.id.startsWith("gcal_") ? null : parseOccurrenceId(params.id);
    if (occ) {
      const userId = await apiUserId(request);
      if (!userId) {
        return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
      }
      if (scope === "all") await deleteNativeSeries(userId, occ.seriesId);
      else if (scope === "following") await deleteNativeFollowing(userId, params.id);
      else await deleteNativeOccurrence(userId, params.id);
      return Response.json({ ok: true });
    }
    if (params.id.startsWith("gcal_")) {
      const userId = await apiUserId(request);
      if (!userId) {
        return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
      }
      const url = new URL(request.url);
      const gcalId = await resolveGoogleCalendarId(
        userId,
        url.searchParams.get("calendarId"),
      );
      if (!gcalId) {
        return Response.json(
          { error: "Google 캘린더를 찾을 수 없어요." },
          { status: 400 },
        );
      }
      if (scope === "following") {
        return Response.json({ error: FOLLOWING_GOOGLE }, { status: 400 });
      }
      if (scope === "all" && GOOGLE_INSTANCE.test(params.id)) {
        const { getAuthenticatedCalendar } = await import("@/lib/google");
        const cal = await getAuthenticatedCalendar(userId);
        if (!cal) {
          return Response.json({ error: "Google 캘린더 연결이 필요해요." }, { status: 400 });
        }
        await deleteGoogleSeries(cal, gcalId, params.id.slice("gcal_".length));
        return Response.json({ ok: true });
      }
      const result = await deleteGoogleEvent(
        gcalId,
        params.id.slice("gcal_".length),
      );
      if ("error" in result) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true });
    }

    await deleteEvent(params.id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("api event delete", err);
    return Response.json(
      { error: "일정을 삭제하지 못했어요. 이미 삭제된 일정일 수 있어요." },
      { status: 400 },
    );
  }
}
