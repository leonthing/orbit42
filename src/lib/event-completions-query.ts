import { getAdminClient } from "@/lib/supabase";
import { normalizeEventKey } from "@/lib/event-key";

/**
 * 완료 표시 조회 — 세션이 아니라 userId 로 찾는다.
 *
 * `event-completions.ts` 는 "use server" 서버 액션 파일이라 클라이언트에서
 * 호출 가능한 표면이 된다. userId 를 인자로 받는 조회는 그쪽에 두면 안 되므로
 * 서버 전용 모듈로 분리했다.
 */
export async function completedKeysFor(
  userId: string,
  keys: string[],
): Promise<Set<string>> {
  if (!userId || keys.length === 0) return new Set();
  const db = getAdminClient();
  const found = new Set<string>();
  // Supabase 의 .in() 은 URL 길이 제한이 있어 넉넉히 잘라 보낸다.
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const { data } = await db
      .from("event_completions")
      .select("event_key")
      .eq("user_id", userId)
      .in("event_key", keys.slice(i, i + CHUNK));
    for (const r of data ?? []) found.add(r.event_key as string);
  }
  return found;
}

/**
 * 여러 사람의 완료 표시를 한 번에 — 팔로잉 타임라인용.
 * 돌려주는 Set 의 원소는 `${userId}|${eventKey}` 형태다.
 */
export async function completedPairsFor(
  userIds: string[],
  keys: string[],
): Promise<Set<string>> {
  if (userIds.length === 0 || keys.length === 0) return new Set();
  const db = getAdminClient();
  const found = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const { data } = await db
      .from("event_completions")
      .select("user_id, event_key")
      .in("user_id", userIds)
      .in("event_key", keys.slice(i, i + CHUNK));
    for (const r of data ?? []) {
      found.add(`${r.user_id as string}|${r.event_key as string}`);
    }
  }
  return found;
}

/** 타임라인 블록 id(`native:…` / `…::…`) → 완료 키 */
export function completionKeyForBlock(blockId: string): string {
  return normalizeEventKey(blockId);
}
