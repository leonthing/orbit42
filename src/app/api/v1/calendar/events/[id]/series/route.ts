import { apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { nativeSeriesInfo, googleSeriesInfo } from "@/lib/recurrence-write";

export const dynamic = "force-dynamic";

// GET ?calendarId=<native-uuid> — 반복 회차의 시리즈 정보(수정 화면의 반복 선택값)
// → { rrule: string|null, isAnniversary: boolean, seriesStart: string|null }
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  try {
    if (!params.id.startsWith("gcal_")) {
      return Response.json(await nativeSeriesInfo(userId, params.id));
    }
    const calendarId = new URL(request.url).searchParams.get("calendarId");
    const db = getAdminClient();
    let q = db.from("calendars").select("google_calendar_id").eq("user_id", userId).eq("source", "google");
    if (calendarId) q = q.eq("id", calendarId);
    const { data: cals } = await q;
    const gcalIds = (cals ?? []).map((c) => c.google_calendar_id as string | null).filter(Boolean) as string[];
    const { getAuthenticatedCalendar } = await import("@/lib/google");
    const cal = await getAuthenticatedCalendar(userId);
    if (!cal || gcalIds.length === 0) {
      return Response.json({ error: "Google 캘린더 연결이 필요해요." }, { status: 400 });
    }
    const gcalId = calendarId || gcalIds.length === 1 ? gcalIds[0] : "primary";
    const info = await googleSeriesInfo(cal, gcalId, params.id.slice("gcal_".length));
    return Response.json({ rrule: info.rrule, isAnniversary: info.isAnniversary, seriesStart: info.seriesStart });
  } catch (err) {
    console.error("api event series", err);
    return Response.json({ error: "반복 정보를 읽지 못했어요." }, { status: 400 });
  }
}
