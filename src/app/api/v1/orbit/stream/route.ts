import { apiSession } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { toApiSlot } from "@/lib/api-slots";
import type { TimeSlot } from "@/lib/slots";

export const dynamic = "force-dynamic";

// GET — 오르빗 스트림: 팔로우한 사람들의 최근 활동.
// 시간 로그(사진 붙은 완료 일정, 팔로워/전체 공개) + 새로 열린 타임슬롯을
// 시간순으로 섞어 내려준다. 글을 쓰지 않아도 살면 쌓이는 피드.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const people = await listFollowing(session.username);
  if (people.length === 0) {
    return Response.json({ items: [] });
  }
  const userById = new Map(
    people.map((p) => {
      const person = p as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      };
      return [person.id, person] as const;
    }),
  );
  const ids = Array.from(userById.keys());

  const db = getAdminClient();
  const [postsRes, slotsRes, metaRes] = await Promise.all([
    db
      .from("event_posts")
      .select("*")
      .in("user_id", ids)
      .in("visibility", ["followers", "public"])
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("time_slots")
      .select("*")
      .in("host_id", ids)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("users").select("id, is_private").in("id", ids),
  ]);

  // 비공개로 전환한 사람은 스트림에서도 제외.
  const privateIds = new Set(
    (metaRes.data ?? []).filter((r) => r.is_private).map((r) => r.id as string),
  );

  type StreamItem = {
    id: string;
    type: "timelog" | "slot";
    createdAt: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    post?: unknown;
    slot?: unknown;
  };

  const items: StreamItem[] = [];
  for (const row of postsRes.data ?? []) {
    const user = userById.get(row.user_id as string);
    if (!user || privateIds.has(user.id)) continue;
    const imageUrls = (row.image_urls as string[] | null) ?? [];
    if (imageUrls.length === 0) continue; // 사진 없는 기록은 스트림에서 제외
    items.push({
      id: `post_${row.id}`,
      type: "timelog",
      createdAt: row.created_at as string,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      post: {
        id: row.id,
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
        allDay: row.all_day,
        note: row.note,
        imageUrls,
        visibility: row.visibility,
      },
    });
  }
  for (const row of slotsRes.data ?? []) {
    const user = userById.get(row.host_id as string);
    if (!user || privateIds.has(user.id)) continue;
    items.push({
      id: `slot_${row.id}`,
      type: "slot",
      createdAt: row.created_at as string,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      slot: toApiSlot(row as TimeSlot, user.username),
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return Response.json({ items: items.slice(0, 30) });
}
