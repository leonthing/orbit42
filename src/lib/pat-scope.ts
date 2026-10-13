/**
 * 개인 액세스 토큰(personal_access)이 부를 수 있는 API — 읽기 + 완료 체크만.
 * 미들웨어(엣지)와 apiSession 이 함께 쓰므로 DB·Node 의존이 없어야 한다.
 */
export const PAT_PURPOSE = "personal_access";

const ALLOWED: Array<{ method: string; path: RegExp }> = [
  { method: "GET", path: /^\/api\/v1\/calendar\/events\/?$/ },
  { method: "GET", path: /^\/api\/v1\/bookings\/?$/ },
  { method: "PUT", path: /^\/api\/v1\/calendar\/events\/[^/]+\/completion\/?$/ },
];

export function patAllows(method: string, pathname: string): boolean {
  return ALLOWED.some((a) => a.method === method.toUpperCase() && a.path.test(pathname));
}
