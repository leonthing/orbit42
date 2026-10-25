/**
 * 가입·자동 아이디 생성에서 쓸 수 없는 아이디.
 * 앱 화면(인트로 이미지 등)에 예시로 찍힌 아이디 — 나중에 누군가 가입하면 그 사람 페이지처럼 보이므로 막아 둔다.
 * (둘러보기 예시 아이디 example.user 등은 마침표가 있어 원래 가입할 수 없다.)
 */
const RESERVED = new Set<string>([
  "intro-example", // 개선-48 인트로 '내 링크 페이지' 이미지
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED.has(username.trim().toLowerCase());
}
