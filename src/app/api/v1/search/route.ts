import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

// GET ?q= — 사람·열린 슬롯 통합 검색 (지목형 조회의 진입점)
// 비공개 프로필과 차단 관계(양방향)는 결과에서 제외한다.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 1) {
    return Response.json({ users: [], slots: [] });
  }

  let result = await searchAll(q);

  // 결과 사용자들의 비공개 여부 + 나와의 차단 관계를 한 번에 조회해 필터.
  const myId = await apiUserId(request);
  const usernames = Array.from(
    new Set([
      ...result.users.map((u) => u.username),
      ...result.slots.map((s) => s.host.username),
    ]),
  );
  if (usernames.length > 0 && myId) {
    const db = getAdminClient();
    const { data: rows } = await db
      .from("users")
      .select("id, username, is_private")
      .in("username", usernames);
    const ids = (rows ?? []).map((r) => r.id as string);
    const { data: blockRows } = await db
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`)
      .or(`blocker_id.in.(${ids.join(",")}),blocked_id.in.(${ids.join(",")})`);
    const blockedIds = new Set<string>();
    for (const b of blockRows ?? []) {
      if (b.blocker_id === myId) blockedIds.add(b.blocked_id as string);
      if (b.blocked_id === myId) blockedIds.add(b.blocker_id as string);
    }
    const hidden = new Set(
      (rows ?? [])
        .filter(
          (r) =>
            (r.is_private && r.username !== session.username) ||
            blockedIds.has(r.id as string),
        )
        .map((r) => r.username as string),
    );
    result = {
      users: result.users.filter((u) => !hidden.has(u.username)),
      slots: result.slots.filter((s) => !hidden.has(s.host.username)),
    };
  }

  return Response.json({
    users: result.users.map((u) => ({
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      interests: u.interests,
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
