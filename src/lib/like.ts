/**
 * LIKE/ILIKE 에 사용자 글자를 넣을 때 — '%'·'_'·'\' 를 글자 그대로 맞추게 이스케이프(PostgreSQL 기본 이스케이프 문자 '\').
 * 부분 검색(likeContains)에만 쓴다 — 이메일 같은 '같은 값' 찾기는 LIKE 를 쓰지 않는다(email-lookup.ts, 정확 일치).
 * PostgREST 는 like 값의 '*' 를 '%' 로 바꾸므로 '*' 는 뺀다(아이디·이메일에 쓰이지 않음).
 */
export function escapeLike(s: string): string {
  return s.replace(/\*/g, "").replace(/[\\%_]/g, (m) => "\\" + m);
}

export const likeContains = (s: string) => `%${escapeLike(s)}%`;

/**
 * PostgREST `.or(...)` 문법 안에 값을 넣을 때 큰따옴표로 감싼다 — ',' '.' ':' '(' ')' 가 문법으로 읽히지 않게.
 * 따옴표 안에서는 '"' 와 '\' 를 '\' 로 이스케이프한다.
 */
export function pgrstQuote(v: string): string {
  return `"${v.replace(/["\\]/g, (m) => "\\" + m)}"`;
}
