import { apiSession } from "@/lib/api-auth";
import {
  listLocationBuffers,
  createLocationBuffer,
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

// GET — 장소별 이동시간 버퍼 목록
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  return Response.json({ buffers: await listApi() });
}

// POST { name, bufferMin, aliases? }
export async function POST(request: Request) {
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
  const bufferMin = Number(body.bufferMin);
  if (!Number.isInteger(bufferMin)) {
    return Response.json({ error: "버퍼(분)가 올바르지 않아요." }, { status: 400 });
  }
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.map(String).slice(0, 10)
    : [];

  const result = await createLocationBuffer({
    name: String(body.name ?? ""),
    buffer_min: bufferMin,
    aliases,
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ buffers: await listApi() });
}
