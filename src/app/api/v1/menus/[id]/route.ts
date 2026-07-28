import { apiSession } from "@/lib/api-auth";
import { listMyMenus, updateMenu, deleteMenu } from "@/lib/menus";
import { toApiMenu } from "../route";

export const dynamic = "force-dynamic";

// PATCH { name?, category?, description?, priceCents?, active? }
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

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 80) {
      return Response.json({ error: "이름은 1~80자여야 해요." }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.category !== undefined) {
    patch.category = body.category === null ? null : String(body.category).trim() || null;
  }
  if (body.description !== undefined) {
    patch.description =
      body.description === null ? null : String(body.description).trim() || null;
  }
  if (body.priceCents !== undefined) {
    const v = Number(body.priceCents);
    if (!Number.isFinite(v) || v < 0 || v > 1_000_000_000) {
      return Response.json({ error: "가격이 올바르지 않아요." }, { status: 400 });
    }
    patch.price_cents = Math.round(v);
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }
  const result = await updateMenu(params.id, patch);
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const menus = await listMyMenus();
  return Response.json({ menus: menus.map(toApiMenu) });
}

// DELETE — 서비스 삭제
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await deleteMenu(params.id);
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const menus = await listMyMenus();
  return Response.json({ menus: menus.map(toApiMenu) });
}
