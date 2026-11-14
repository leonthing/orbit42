import { cardsMe, cardsError, parseCard } from "@/lib/cards-route";
import { saveCard, candidateView, type CardPhoto, type SaveChoice } from "@/lib/cards-google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PHOTO = 2 * 1024 * 1024;

/**
 * POST multipart: card(JSON) · choice(JSON {kind:"create"} | {kind:"update",resourceName}) · seen(JSON 화면에 보인 후보들) · front · back(JPEG)
 * 사진은 메모리에서 바로 Leo Drive 로 — 서버·DB 에 남기지 않는다.
 * → 200 { ok, kind, resourceName, name } | 409 { reason:"new_candidates", candidates } (다시 고르기)
 */
export async function POST(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "보낸 내용을 읽지 못했어요." }, { status: 400 });
  const json = (k: string) => {
    try { return JSON.parse(String(form.get(k) ?? "null")); } catch { return null; }
  };
  const card = parseCard(json("card"));
  if (!card) return Response.json({ error: "이름을 넣어 주세요." }, { status: 400 });
  const c = json("choice") as { kind?: string; resourceName?: unknown } | null;
  let choice: SaveChoice;
  if (c?.kind === "create") choice = { kind: "create" };
  else if (c?.kind === "update" && typeof c.resourceName === "string" && /^people\/[\w-]+$/.test(c.resourceName))
    choice = { kind: "update", resourceName: c.resourceName };
  else return Response.json({ error: "저장 방법을 골라 주세요." }, { status: 400 });
  const seenRaw = json("seen");
  const seen = Array.isArray(seenRaw) ? seenRaw.filter((x): x is string => typeof x === "string").slice(0, 50) : [];

  const photos: CardPhoto[] = [];
  for (const [key, side] of [["front", "앞"], ["back", "뒤"]] as const) {
    const f = form.get(key);
    if (!(f instanceof Blob) || f.size === 0) continue;
    if (f.size > MAX_PHOTO) return Response.json({ error: "사진이 너무 커요." }, { status: 413 });
    const data = Buffer.from(await f.arrayBuffer());
    // JPEG 만(앱이 압축해서 보냄)
    if (!(data[0] === 0xff && data[1] === 0xd8)) return Response.json({ error: "사진 형식이 맞지 않아요." }, { status: 400 });
    photos.push({ side, data, mime: "image/jpeg" });
  }
  try {
    const r = await saveCard(a.id, card, choice, seen, photos);
    if (!r.ok && r.reason === "new_candidates")
      return Response.json({ error: "같은 사람으로 보이는 연락처가 새로 보여요. 다시 골라 주세요.", reason: r.reason, candidates: r.candidates.map(candidateView) }, { status: 409 });
    if (!r.ok) return Response.json({ error: "고른 연락처가 이 명함과 같은 사람 후보가 아니에요.", reason: r.reason }, { status: 409 });
    return Response.json(r);
  } catch (e) {
    return cardsError(e);
  }
}
