/**
 * 방문 출처 범주 (1.8.0) — 브라우저에서 리퍼러 도메인과 앱 안 브라우저 UA로 범주만 정한다.
 * 범주 이름만 서버로 보내고, 리퍼러 주소·도메인·UA는 보내지도 저장하지도 않는다.
 * 서버(lib/funnel)는 아래 목록에 있는 값만 센다.
 */
export const FUNNEL_REFS = ["instagram", "kakao", "threads", "x", "youtube", "search", "orbit42", "direct", "other"] as const;
export type FunnelRef = (typeof FUNNEL_REFS)[number];

export function parseFunnelRef(v: unknown): FunnelRef | null {
  return typeof v === "string" && (FUNNEL_REFS as readonly string[]).includes(v) ? (v as FunnelRef) : null;
}

/** 리퍼러 호스트(없으면 빈 문자열)와 UA로 범주를 정한다 (순수 함수) */
export function funnelRefFrom(referrerHost: string, userAgent: string): FunnelRef {
  const h = referrerHost.toLowerCase().replace(/^www\./, "");
  const is = (...domains: string[]) => domains.some((d) => h === d || h.endsWith(`.${d}`));
  if (h) {
    if (is("orbit42.org", "localhost")) return "orbit42";
    if (is("instagram.com")) return "instagram";
    if (is("kakao.com", "kakaocdn.net", "kakao.co.kr")) return "kakao";
    if (is("threads.net", "threads.com")) return "threads";
    if (is("x.com", "twitter.com", "t.co")) return "x";
    if (is("youtube.com", "youtu.be")) return "youtube";
    if (is("naver.com", "daum.net", "bing.com") || /(^|\.)google\.[a-z.]+$/.test(h)) return "search";
    return "other";
  }
  // 리퍼러가 없을 때만 앱 안 브라우저 UA로 판단 (인스타·카톡은 리퍼러를 빼고 여는 경우가 많다)
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/KAKAOTALK/i.test(userAgent)) return "kakao";
  if (/Barcelona/i.test(userAgent)) return "threads"; // Threads 앱 안 브라우저
  return "direct";
}
