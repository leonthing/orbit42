import { safeHttpUrl } from "@/lib/custom-links";

/**
 * 프로필 SNS 링크(users.social_links) — 저장할 때와 그릴 때 모두 거른다(보안-7).
 * javascript:·data: 같은 주소가 href 로 나가면 방문자 브라우저에서 스크립트가 돈다.
 * 설정 화면은 아이디(@handle)와 주소를 둘 다 받는다:
 * - scheme 이 있으면 http(s) 만
 * - 'instagram.com/x'·'www.…' 처럼 경로가 있는 주소는 https:// 를 붙인다
 * - 나머지는 아이디로 보고 각 서비스 주소로 만든다
 */
export const SOCIAL_LINK_KEYS = ["instagram", "x", "youtube", "facebook", "linkedin"] as const;
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
export type SafeSocialLinks = Partial<Record<SocialLinkKey, string>>;

const HANDLE = /^[A-Za-z0-9._-]{1,100}$/;
const PROFILE_URL: Record<SocialLinkKey, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  x: (h) => `https://x.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
};

export function socialHref(key: SocialLinkKey, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > 300) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return safeHttpUrl(v);
  if (/\s/.test(v)) return null;
  if (v.includes("/") || /^www\./i.test(v)) return safeHttpUrl(`https://${v.replace(/^\/+/, "")}`);
  const h = v.replace(/^@/, "");
  return HANDLE.test(h) ? PROFILE_URL[key](h) : null;
}

/** 그릴 때 — 서비스별 주소로 바꾸고, 잘못된 값은 조용히 뺀다 */
export function safeSocialLinks(input: unknown): SafeSocialLinks {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: SafeSocialLinks = {};
  for (const k of SOCIAL_LINK_KEYS) {
    const u = socialHref(k, src[k]);
    if (u) out[k] = u;
  }
  return out;
}

/** 저장할 때 — 입력한 그대로 두되, 그릴 수 없는 값(javascript: 등)은 거절한다 */
export function parseSocialLinks(input: unknown): { links: SafeSocialLinks } | { error: string } {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: SafeSocialLinks = {};
  for (const k of SOCIAL_LINK_KEYS) {
    const raw = src[k];
    if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) continue;
    if (!socialHref(k, raw)) return { error: "SNS 링크는 아이디나 http(s) 주소만 넣을 수 있어요." };
    out[k] = String(raw).trim();
  }
  return { links: out };
}
