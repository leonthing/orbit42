import { apiSession } from "@/lib/api-auth";
import { listMyMenus, createMenu } from "@/lib/menus";

export const dynamic = "force-dynamic";

/** 메뉴(서비스) 직렬화 — 프리랜서가 가격을 붙여 파는 항목. */
export function toApiMenu(m: {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_cents: number;
  active: boolean;
  sort_order: number;
}) {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    description: m.description,
    priceCents: m.price_cents,
    active: m.active,
    sortOrder: m.sort_order,
  };
}

// GET — 내 서비스 목록
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const menus = await listMyMenus();
  return Response.json({ menus: menus.map(toApiMenu) });
}

// POST { name, category?, description?, priceCents, active? }
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  let body: {
    name?: string;
    category?: string | null;
    description?: string | null;
    priceCents?: number;
    active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name || name.length > 80) {
    return Response.json({ error: "이름은 1~80자여야 해요." }, { status: 400 });
  }
  const priceCents = Number(body.priceCents ?? 0);
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 1_000_000_000) {
    return Response.json({ error: "가격이 올바르지 않아요." }, { status: 400 });
  }

  const result = await createMenu({
    name,
    category: body.category?.trim() || null,
    description: body.description?.trim() || null,
    price_cents: Math.round(priceCents),
    active: body.active ?? true,
  });
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const menus = await listMyMenus();
  return Response.json({ menus: menus.map(toApiMenu) });
}
