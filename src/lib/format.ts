// 그룹 타임존 기준으로 시각을 표시.

function parts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour"), mi: g("minute") };
}

/** "7/21 14:30" */
export function fmtDateTime(date: Date, timeZone: string): string {
  const { mo, d, h, mi } = parts(date, timeZone);
  return `${Number(mo)}/${Number(d)} ${h}:${mi}`;
}

/** "2026-07-21" */
export function fmtDate(date: Date, timeZone: string): string {
  const { y, mo, d } = parts(date, timeZone);
  return `${y}-${mo}-${d}`;
}

/** "14:30" */
export function fmtTime(date: Date, timeZone: string): string {
  const { h, mi } = parts(date, timeZone);
  return `${h}:${mi}`;
}

/**
 * 우리가 수집한 풀이 시각들로 잔디 캘린더(unix초 UTC자정 -> 개수)를 만든다.
 * 그룹 타임존 기준 날짜로 묶으므로 Heatmap 컴포넌트의 셀 배치와 일치한다.
 */
export function solvesToCalendar(dates: Date[], timeZone: string): Record<string, number> {
  const cal: Record<string, number> = {};
  for (const date of dates) {
    const { y, mo, d } = parts(date, timeZone);
    const key = Math.floor(Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 1000);
    cal[key] = (cal[key] ?? 0) + 1;
  }
  return cal;
}
