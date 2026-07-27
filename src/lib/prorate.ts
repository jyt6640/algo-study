/**
 * 기간 중 가입한 사람은 남은 일수만큼 목표를 비례 적용한다.
 * (기간 시작 전 가입자는 목표 그대로. 마감 직전 가입이면 0이 되어 벌금 없음)
 */
export function proratedQuota(quota: number, startAt: Date, endAt: Date, joinedAt: Date): number {
  if (joinedAt <= startAt) return quota;
  const total = endAt.getTime() - startAt.getTime();
  if (total <= 0) return quota;
  const remaining = endAt.getTime() - joinedAt.getTime();
  if (remaining <= 0) return 0;
  const scaled = Math.round((quota * remaining) / total);
  return Math.min(quota, Math.max(0, scaled));
}
