import { apiSession } from "@/lib/api-auth";
import { createSlotFromPreset } from "@/lib/slots";

export const dynamic = "force-dynamic";

const PRESET_KEYS = ["meeting", "meal", "coffee"] as const;
type PresetKey = (typeof PRESET_KEYS)[number];

// POST { key: "meeting" | "meal" | "coffee" } — 프리셋으로 빠른 슬롯 생성
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!PRESET_KEYS.includes(body.key as PresetKey)) {
    return Response.json({ error: "알 수 없는 템플릿입니다." }, { status: 400 });
  }

  const result = await createSlotFromPreset(body.key as PresetKey);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  if ("skipped" in result) {
    return Response.json({ skipped: true });
  }
  return Response.json({ created: true, slug: result.slug });
}
