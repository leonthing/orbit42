import { apiSession } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { toApiSlot } from "@/lib/api-slots";
import type { TimeSlot } from "@/lib/slots";

export const dynamic = "force-dynamic";

// GET — 내 궤도: 팔로우한 사람들과 그들의 열린 타임슬롯.
// 피드가 아니라 "아는 사람들의 예약 가능한 시간 디렉토리"다.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let people = await listFollowing(session.username);
  if (people.length === 0) {
    return Response.json({ people: [] });
  }

  const db = getAdminClient();

  // 비공개로 전환한 사람은 오르빗 노출에서도 제외한다.
  {
    const allIds = people.map((p) => (p as { id: string }).id);
    const { data: privacyRows } = await db
      .from("users")
      .select("id, is_private")
      .in("id", allIds);
    const privateIds = new Set(
      (privacyRows ?? []).filter((r) => r.is_private).map((r) => r.id as string),
    );
    people = people.filter((p) => !privateIds.has((p as { id: string }).id));
    if (people.length === 0) {
      return Response.json({ people: [] });
    }
  }

  // 팔로우한 전원의 활성 슬롯을 한 번에 조회해 사람별로 묶는다.
  const ids = people.map((p) => (p as { id: string }).id);
  const { data: slotRows } = await db
    .from("time_slots")
    .select("*")
    .in("host_id", ids)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const slotsByHost = new Map<string, TimeSlot[]>();
  for (const s of (slotRows ?? []) as TimeSlot[]) {
    const list = slotsByHost.get(s.host_id) ?? [];
    list.push(s);
    slotsByHost.set(s.host_id, list);
  }

  return Response.json({
    people: people.map((p) => {
      const person = p as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      };
      return {
        username: person.username,
        displayName: person.display_name,
        avatarUrl: person.avatar_url,
        slots: (slotsByHost.get(person.id) ?? []).map((s) =>
          toApiSlot(s, person.username),
        ),
      };
    }),
  });
}
