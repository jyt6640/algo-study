/** 벌금 계산. 앱은 계산·표시만 하고 실제 정산은 오프라인. */
export function calcPenalty(
  penaltyType: "FIXED" | "PER_MISSING",
  penaltyAmount: number,
  quota: number,
  solved: number,
): number {
  if (solved >= quota) return 0;
  if (penaltyType === "FIXED") return penaltyAmount;
  // PER_MISSING: 부족한 문제 수 × 단가
  return (quota - solved) * penaltyAmount;
}
