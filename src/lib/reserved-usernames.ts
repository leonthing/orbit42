import { RENAMED_USERNAMES } from "@/lib/renamed-usernames";

/**
 * 가입·자동 아이디 생성에서 쓸 수 없는 아이디.
 * 앱 화면(인트로 이미지 등)에 예시로 찍힌 아이디 — 나중에 누군가 가입하면 그 사람 페이지처럼 보이므로 막아 둔다.
 * (둘러보기 예시 아이디 example.user 등은 마침표가 있어 원래 가입할 수 없다.)
 */
const RESERVED = new Set<string>([
  "intro-example", // 개선-48 인트로 '내 링크 페이지' 이미지
  // 1.6.0·1.7.0 스토어 스크린샷(링크 페이지·공유 카드 QR)과 둘러보기 예시 아이디.
  // 마침표가 있어 지금은 가입할 수 없지만, 규칙이 느슨해질 때와 마침표 뺀 비슷한 아이디(사칭)까지 막는다.
  "harin.design", "harindesign",
  "example.user", "exampleuser",
  "coach.example", "coachexample",
  "designer.example", "designerexample",
  // 1.9.0 심사용 상대 데모 계정(운영에 있음, PO 11/13) — 지운 뒤에도 남이 가져가거나 비슷한 아이디로 사칭하지 못하게.
  // 이미 있는 계정의 로그인·화면에는 영향 없음(가입·자동 아이디 생성에서만 확인).
  "demodoyun", "demo.doyun", "demo-doyun", "demo_doyun",
  "demoseoyeon", "demo.seoyeon", "demo-seoyeon", "demo_seoyeon",
]);

export function isReservedUsername(username: string): boolean {
  const u = username.trim().toLowerCase();
  // 아이디를 바꾼 계정의 옛 아이디도 막는다 — 옛 주소·추천 링크를 다른 사람이 가져가지 못하게
  return RESERVED.has(u) || u in RENAMED_USERNAMES;
}
