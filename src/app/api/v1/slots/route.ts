import { apiSession } from "@/lib/api-auth";
import { sanitizeWorkingHours, toApiSlot, toApiSlotDetail } from "@/lib/api-slots";
import { createSlot, listMySlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

// GET — 내 슬롯 목록. getSession의 Bearer 폴백 덕에 listMySlots를 그대로 호출.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const slots = await listMySlots();
  return Response.json({
    slots: slots.map((s) => toApiSlot(s, session.username)),
  });
}

// POST — 간단 슬롯 생성(무엇을·얼마나·언제). 매주 같은 시간(auto) 모드로 만든다.
// { title, durationMin, priceCents, workingHours, autoApprove?, showOnFeed?, location?, description? }
export async function POST(request: Request) {
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

  const title = String(body.title ?? "").trim();
  if (!title || title.length > 100) {
    return Response.json({ error: "제목은 1~100자여야 해요." }, { status: 400 });
  }
  const duration = Number(body.durationMin ?? 60);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    return Response.json({ error: "소요시간은 5~480분이어야 해요." }, { status: 400 });
  }
  const price = Number(body.priceCents ?? 0);
  if (!Number.isInteger(price) || price < 0 || price > 100_000_000_00) {
    return Response.json({ error: "가격이 올바르지 않아요." }, { status: 400 });
  }
  const workingHours = sanitizeWorkingHours(
    body.workingHours ?? {
      mon: [{ start: "10:00", end: "18:00" }],
      tue: [{ start: "10:00", end: "18:00" }],
      wed: [{ start: "10:00", end: "18:00" }],
      thu: [{ start: "10:00", end: "18:00" }],
      fri: [{ start: "10:00", end: "18:00" }],
    },
  );
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return Response.json({ error: "예약 받을 요일과 시간을 골라주세요." }, { status: 400 });
  }
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 200) : "";

  const result = await createSlot({
    title,
    description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
    duration_min: duration,
    price_cents: price,
    capacity: 1,
    slot_type: "1on1",
    location_detail: location || null,
    locations: location ? [location] : [],
    mode: "auto",
    pricing_model: "fixed",
    working_hours: workingHours,
    // 30분 단위로 시작 시각을 맞춘다 (50분 세션도 정시·30분에 시작)
    slot_interval_min: duration < 60 ? duration + ((60 - duration) % 30) : duration,
    min_notice_hours: 4,
    max_advance_days: 30,
    buffer_min: 0,
    auto_approve: body.autoApprove !== false,
    payment_method: "offline",
    image_urls: [],
    show_on_feed: body.showOnFeed === true,
  });
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const slots = await listMySlots();
  const created = slots.find((s) => s.id === (result as { id: string }).id);
  if (!created) {
    return Response.json({ error: "슬롯을 만들었지만 불러오지 못했어요." }, { status: 500 });
  }
  return Response.json({ slot: toApiSlotDetail(created, session.username, []) });
}
