import { apiSession } from "@/lib/api-auth";
import {
  listLocationBuffers,
  updateLocationBuffer,
  deleteLocationBuffer,
} from "@/lib/location-buffers";

export const dynamic = "force-dynamic";

async function listApi() {
  const rows = await listLocationBuffers();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bufferMin: r.buffer_min,
    aliases: r.aliases,
  }));
}

// PATCH { name?, bufferMin?, aliases? }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { name?: string; bufferMin?: number; aliases?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const patch: { name?: string; buffer_min?: number; aliases?: string[] } = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.bufferMin !== undefined) {
    const v = Number(body.bufferMin);
    if (!Number.isInteger(v)) {
      return Response.json({ error: "버퍼(분)가 올바르지 않아요." }, { status: 400 });
    }
    patch.buffer_min = v;
  }
  if (body.aliases !== undefined) {
    if (!Array.isArray(body.aliases)) {
      return Response.json({ error: "별칭 형식이 올바르지 않아요." }, { status: 400 });
    }
    patch.aliases = body.aliases.map(String).slice(0, 10);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const result = await updateLocationBuffer(params.id, patch);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ buffers: await listApi() });
}

// DELETE
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await deleteLocationBuffer(params.id);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ buffers: await listApi() });
}
