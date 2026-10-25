/**
 * 공개 링크 페이지 직접 링크 (개선-46) — 호스트가 고른 웹사이트·오픈채팅·블로그 등.
 * users.custom_links = [{ title, url }] 최대 5개. http/https 주소만, 제목 1~40자.
 * 저장할 때와 그릴 때 모두 이 검사를 거친다(javascript: 같은 주소가 화면에 나가지 않게).
 */
export type CustomLink = { title: string; url: string };

export const CUSTOM_LINKS_MAX = 5;
export const CUSTOM_LINK_TITLE_MAX = 40;
const URL_MAX = 300;

/** http/https 주소면 정리한 문자열, 아니면 null */
export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > URL_MAX) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname || u.username || u.password) return null;
  return u.toString();
}

/** 저장용 — 잘못된 값이 하나라도 있으면 그 이유를 돌려준다 */
export function parseCustomLinks(input: unknown): { links: CustomLink[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "링크 형식이 올바르지 않아요." };
  if (input.length > CUSTOM_LINKS_MAX) return { error: `링크는 ${CUSTOM_LINKS_MAX}개까지 올릴 수 있어요.` };
  const links: CustomLink[] = [];
  for (const item of input) {
    const o = (item ?? {}) as { title?: unknown; url?: unknown };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) return { error: "링크 제목을 적어 주세요." };
    if (title.length > CUSTOM_LINK_TITLE_MAX) return { error: `링크 제목은 ${CUSTOM_LINK_TITLE_MAX}자까지예요.` };
    const url = safeHttpUrl(o.url);
    if (!url) return { error: "주소는 http:// 또는 https:// 로 시작해야 해요." };
    links.push({ title, url });
  }
  return { links };
}

/** 그릴 때용 — 잘못된 항목은 조용히 뺀다 */
export function displayCustomLinks(raw: unknown): CustomLink[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomLink[] = [];
  for (const item of raw.slice(0, CUSTOM_LINKS_MAX)) {
    const o = (item ?? {}) as { title?: unknown; url?: unknown };
    const title = typeof o.title === "string" ? o.title.trim().slice(0, CUSTOM_LINK_TITLE_MAX) : "";
    const url = safeHttpUrl(o.url);
    if (title && url) out.push({ title, url });
  }
  return out;
}
