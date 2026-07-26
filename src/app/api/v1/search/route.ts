import { apiSession } from "@/lib/api-auth";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

// GET ?q= — 사람·열린 슬롯 통합 검색 (지목형 조회의 진입점)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 1) {
    return Response.json({ users: [], slots: [] });
  }

  const result = await searchAll(q);
  return Response.json({
    users: result.users.map((u) => ({
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
    })),
    slots: result.slots.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      hostUsername: s.host.username,
      hostName: s.host.display_name ?? s.host.username,
      priceCents: s.price_cents,
      pricingModel: s.pricing_model,
      durationMin: s.duration_min,
    })),
  });
}
