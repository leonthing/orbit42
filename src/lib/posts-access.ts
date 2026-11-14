/**
 * 글·사진(1.10.0) 시험 기간 허용 목록 — 처리방침 개정 전이라 내부 계정만(PO 11/14).
 * 운영 env POSTS_PREVIEW_USER_IDS(쉼표로 구분한 users.id). 없으면 1.9.0 미리보기 목록
 * V190_PREVIEW_USER_IDS(leokim·appreview·데모 상대 2명)를 같이 쓴다.
 * 로컬 실측만 POSTS_FORCE_OPEN=1 로 모두에게 연다(운영에는 넣지 않는다).
 */
/** 공개 스위치(11/27 처리방침 시행 뒤 Leo 결정): POSTS_PUBLIC=1 이면 비로그인 방문자·사이트맵·RSS·OG 까지 열린다 */
export function postsPublic(): boolean {
  return process.env.POSTS_OFF !== "1" && process.env.POSTS_PUBLIC === "1";
}

/** 남의 공개 글을 볼 수 있는지 — 공개 스위치가 켜졌으면 누구나(비로그인 포함), 아니면 허용 목록 계정만 */
export function postsVisibleTo(viewerId: string | null | undefined): boolean {
  return postsPublic() || postsOpenFor(viewerId);
}

/** 쓰기·❤️·신고 같은 로그인 기능 — 공개 스위치가 켜졌으면 로그인한 누구나, 아니면 허용 목록 계정만 */
export function postsOpenFor(userId: string | null | undefined): boolean {
  if (!userId || process.env.POSTS_OFF === "1") return false;
  if (postsPublic()) return true;
  if (process.env.POSTS_FORCE_OPEN === "1" && process.env.NODE_ENV !== "production") return true;
  const raw = process.env.POSTS_PREVIEW_USER_IDS ?? process.env.V190_PREVIEW_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
