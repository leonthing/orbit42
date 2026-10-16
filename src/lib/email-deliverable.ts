/**
 * 메일을 받을 수 없는 주소인지 — 구글 참석자(초대·변경 메일)로 넣기 전에 본다.
 * orbit42.org 는 받는 메일 서버(MX)가 없어, 심사·테스트 데모 계정(appreview@orbit42.org)을 참석자로 넣으면
 * 구글 초대 메일이 반송·지연된다(2026-10-13 실측, 개선-18). 실제 사용자 주소에는 이 도메인이 없다.
 */
const UNDELIVERABLE_DOMAINS = new Set(["orbit42.org"]);

export function canReceiveEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain !== "" && !UNDELIVERABLE_DOMAINS.has(domain);
}
