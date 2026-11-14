/**
 * 명함 → 구글 연락처 1차(11/15 Leo 승인) — Leo 전용 허용 목록.
 * 운영 env CARDS_PREVIEW_USER_IDS(쉼표로 구분한 users.id). 값이 없거나 비면 아무에게도 열지 않는다(fail closed).
 * CARDS_OFF=1 이면 모두 닫는다. 다른 계정에는 진입점도 보이지 않게 이 함수 하나로 가른다.
 */
export function cardsOpenFor(userId: string | null | undefined): boolean {
  if (!userId || process.env.CARDS_OFF === "1") return false;
  const raw = process.env.CARDS_PREVIEW_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
