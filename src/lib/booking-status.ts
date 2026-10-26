/**
 * 새 예약의 처음 상태를 정한다 (개선-38).
 * - 유료(경매 아님) + 결제 안내 있음 → 입금 대기(pending + payment awaiting)
 * - 유료(경매 아님) + 결제 안내 없음 → 자동 승인 설정과 상관없이 승인 대기(pending) — 돈을 받기 전에 확정되지 않게
 * - 그 밖에는 링크의 자동 승인 설정대로
 */
export function decideBookingStatus(args: {
  priceCents: number | null | undefined;
  pricingModel: string | null | undefined;
  paymentInstructions: string | null | undefined;
  autoApprove: boolean | null | undefined;
}) {
  const paid = (args.priceCents ?? 0) > 0 && args.pricingModel !== "auction";
  const hasInstructions = !!(args.paymentInstructions ?? "").trim();
  const awaitingPayment = paid && hasInstructions;
  const paymentInstructionsMissing = paid && !hasInstructions;
  const autoApprove = args.autoApprove !== false && !awaitingPayment && !paymentInstructionsMissing;
  return {
    awaitingPayment,
    paymentInstructionsMissing,
    autoApprove,
    status: (autoApprove ? "confirmed" : "pending") as "confirmed" | "pending",
  };
}
