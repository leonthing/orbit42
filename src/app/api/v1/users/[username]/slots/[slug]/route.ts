import { apiSession } from "@/lib/api-auth";
import {
  getSlotBySlug,
  getBookableOptions,
  bookSlot,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

// GET ?location= — 예약자 관점 슬롯 상세 + 예약 가능 시간
export async function GET(
  request: Request,
  { params }: { params: { username: string; slug: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const found = await getSlotBySlug(params.username, params.slug);
  if (!found || !found.slot.active) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  const { slot, host } = found;

  const location = new URL(request.url).searchParams.get("location");
  const isAuction = slot.pricing_model === "auction";
  const options = isAuction ? [] : await getBookableOptions(slot, location);

  return Response.json({
    slot: {
      id: slot.id,
      slug: slot.slug,
      title: slot.title,
      description: slot.description,
      durationMin: slot.duration_min,
      priceCents: slot.price_cents,
      pricingModel: slot.pricing_model,
      capacity: slot.capacity,
      slotType: slot.slot_type,
      locations: slot.locations ?? [],
      autoApprove: slot.auto_approve,
      imageUrls: slot.image_urls ?? [],
      hostUsername: host.username,
      hostName: host.display_name ?? host.username,
      isMine: session.username === host.username,
      // 결제 방식 — 현재는 만나서 결제(offline)만 지원
      paymentMethod: slot.payment_method ?? "offline",
    },
    // 이 슬롯에 붙은 서비스(메뉴) — 예약할 때 추가로 고를 수 있다
    menus: (await (await import("@/lib/menus")).listMenusForSlot(slot.id))
      .filter((m) => m.active)
      .map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        priceCents: m.price_cents,
      })),
    options: options.slice(0, 100).map((o) => ({
      startAt: o.start_at,
      endAt: o.end_at,
      remaining: o.remaining,
      availabilityId: o.availability_id,
    })),
    // 경매 슬롯 입찰은 웹에서 — 앱 v1은 고정가 예약만 지원
    auctionNotice: isAuction ? "경매 슬롯이에요. 입찰은 웹에서 할 수 있어요." : null,
  });
}

// POST { startAt? | availabilityId?, message?, location? } — 인앱 예약
export async function POST(
  request: Request,
  { params }: { params: { username: string; slug: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const found = await getSlotBySlug(params.username, params.slug);
  if (!found || !found.slot.active) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  if (found.slot.pricing_model === "auction") {
    return Response.json(
      { error: "경매 슬롯이에요. 입찰은 웹에서 할 수 있어요." },
      { status: 400 },
    );
  }
  if (session.username === params.username) {
    return Response.json({ error: "내 슬롯은 예약할 수 없어요." }, { status: 400 });
  }

  // 차단 관계(양방향)면 예약 불가.
  {
    const { apiUserId } = await import("@/lib/api-auth");
    const { isBlockedEitherWay } = await import("@/lib/blocks");
    const myId = await apiUserId(request);
    if (myId && (await isBlockedEitherWay(myId, found.slot.host_id))) {
      return Response.json({ error: "예약할 수 없는 상대예요." }, { status: 403 });
    }
  }

  let body: {
    startAt?: string;
    availabilityId?: string;
    message?: string;
    location?: string | null;
    /** 함께 예약할 서비스(메뉴) id */
    selectedMenuIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.startAt && !body.availabilityId) {
    return Response.json({ error: "예약할 시간을 선택해주세요." }, { status: 400 });
  }

  const result = await bookSlot({
    slotId: found.slot.id,
    startAt: body.startAt,
    availabilityId: body.availabilityId,
    message: body.message?.slice(0, 1000),
    selected_location: body.location ?? null,
    selected_menu_ids: Array.isArray(body.selectedMenuIds)
      ? body.selectedMenuIds.map(String).slice(0, 20)
      : undefined,
  });
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({
    ok: true,
    // auto_approve 슬롯은 바로 확정, 아니면 호스트 승인 대기
    status: found.slot.auto_approve ? "confirmed" : "pending",
  });
}
