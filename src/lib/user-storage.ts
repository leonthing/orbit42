/**
 * 탈퇴 시 그 사용자가 올린 Storage 파일을 지운다 (처리방침: 회원 탈퇴 시 모든 관련 데이터 즉시 삭제).
 *
 * 경로는 업로드 코드가 정한 사용자 폴더만 — 다른 사용자 파일은 경로로 가려진다.
 *   avatars/<uid>/            프로필 사진 (lib/auth.ts)
 *   feed-media/<uid>/         피드 글 사진 (lib/feed-posts.ts)
 *   feed-media/blog/<uid>/    블로그 사진 (lib/blog-media.ts)
 *   slot-media/<uid>/         예약 링크 사진 (lib/slot-media.ts, slots/[id]/images)
 *   slot-media/timelog/<uid>/ 시간 로그 사진 (lib/event-posts.ts)
 *   slot-media/share/<uid>/   공유 이미지 (me/share-image)
 *
 * 실패해도 던지지 않는다 — 탈퇴는 끝나야 하므로, 실패한 폴더만 로그에 남긴다.
 */

import { getAdminClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000;

export function userStorageFolders(userId: string): Array<[bucket: string, prefix: string]> {
  return [
    ["avatars", userId],
    ["feed-media", userId],
    ["feed-media", `blog/${userId}`],
    ["slot-media", userId],
    ["slot-media", `timelog/${userId}`],
    ["slot-media", `share/${userId}`],
  ];
}

export async function deleteUserStorage(userId: string): Promise<{ removed: number; failed: string[] }> {
  const failed: string[] = [];
  let removed = 0;
  // 빈 값·이상한 id 로 버킷 루트를 지우는 일이 없게.
  if (!UUID.test(userId)) return { removed, failed: ["invalid user id"] };
  const db = getAdminClient();
  for (const [bucket, prefix] of userStorageFolders(userId)) {
    try {
      // 업로드는 모두 폴더 바로 아래 파일 하나 깊이 — 하위 폴더는 없다.
      for (;;) {
        const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE });
        if (error) throw error;
        const keys = (data ?? []).filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
        if (keys.length === 0) break;
        const { error: rmErr } = await db.storage.from(bucket).remove(keys);
        if (rmErr) throw rmErr;
        removed += keys.length;
        if (keys.length < PAGE) break;
      }
    } catch (e) {
      failed.push(`${bucket}/${prefix}`);
      console.error("delete user storage", bucket, prefix, e);
    }
  }
  return { removed, failed };
}
