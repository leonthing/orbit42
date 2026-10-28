/**
 * 데모·시험 계정(앱 심사용 appreview, Leo 시험 구글 계정 leotaurus13)을 실사용자 화면에서 감춘다 (개선-33, 10/28 leotaurus13 추가).
 * 추천·검색·탐색·팔로우한 사람의 열린 시간·최근 활동에서, 보는 사람이 내부 계정이 아니면 뺀다.
 * 내부 계정으로 로그인한 상태(심사자 포함)와 데모·시험 계정의 공개 페이지 자체는 그대로 둔다.
 * 내부 계정 목록은 scripts/metrics-daily.ts 의 INTERNAL 과 같다.
 */
export const DEMO_USERNAMES = new Set(["appreview", "leotaurus13"]);
const INTERNAL_VIEWERS = new Set(["leokim", "appreview", "leotaurus13"]);

/** 이 사람이 보는 목록에서 데모 계정을 빼야 하는지 (로그인 안 한 방문자도 뺀다) */
export function hidesDemoFor(viewerUsername: string | null | undefined): boolean {
  return !viewerUsername || !INTERNAL_VIEWERS.has(viewerUsername);
}

/**
 * 팔로잉·팔로워 목록을 보는 사람 기준으로 거른다 (웹·앱 API 공통).
 * 본인이 자기 목록을 볼 때는 그대로, 남이 볼 때는 비공개 사용자와(내부 계정이 아니면) 데모 계정을 뺀다.
 */
export function visibleConnections<T extends { username: string; is_private?: boolean | null }>(
  rows: T[],
  ownerUsername: string,
  viewerUsername: string | null | undefined,
): T[] {
  if (viewerUsername === ownerUsername) return rows;
  return withoutDemo(
    rows.filter((r) => !r.is_private),
    (r) => r.username,
    viewerUsername,
  );
}

/** 보는 사람 기준 팔로우 숫자에서 데모 계정을 빼야 하는지 (본인이 볼 때는 빼지 않는다) */
export function hidesDemoInCounts(ownerUsername: string, viewerUsername: string | null | undefined): boolean {
  return viewerUsername !== ownerUsername && hidesDemoFor(viewerUsername);
}

/** 목록에서 데모 계정 행을 뺀다 */
export function withoutDemo<T>(
  rows: T[],
  usernameOf: (row: T) => string | null | undefined,
  viewerUsername: string | null | undefined,
): T[] {
  if (!hidesDemoFor(viewerUsername)) return rows;
  return rows.filter((r) => !DEMO_USERNAMES.has(usernameOf(r) ?? ""));
}
