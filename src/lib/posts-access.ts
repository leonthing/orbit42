/**
 * 글·사진(1.10.0) 시험 기간 허용 목록 — 처리방침 개정 전이라 내부 계정만(PO 11/14).
 * 운영 env POSTS_PREVIEW_USER_IDS(쉼표로 구분한 users.id). 없으면 1.9.0 미리보기 목록
 * V190_PREVIEW_USER_IDS(leokim·appreview·데모 상대 2명)를 같이 쓴다.
 * 로컬 실측만 POSTS_FORCE_OPEN=1 로 모두에게 연다(운영에는 넣지 않는다).
 */
export function postsOpenFor(userId: string | null | undefined): boolean {
  if (!userId || process.env.POSTS_OFF === "1") return false;
  if (process.env.POSTS_FORCE_OPEN === "1" && process.env.NODE_ENV !== "production") return true;
  const raw = process.env.POSTS_PREVIEW_USER_IDS ?? process.env.V190_PREVIEW_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
