/**
 * 직접 추가한 문제의 해결 시각.
 * 고른 날짜(YYYY-MM-DD)에 "작성하는 지금 시각"을 얹는다. 날짜가 비거나 잘못되면 현재 시각.
 */
export function acceptedAtISO(date: string, now: Date = new Date()): string {
  if (!date) return now.toISOString();
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return now.toISOString();
  const at = new Date(now);
  at.setFullYear(y, m - 1, d);
  return at.toISOString();
}
