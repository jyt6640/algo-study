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

export type DayBreakdown = { leetcode: number; programmers: number };

/**
 * 통합 잔디: LeetCode 전체 제출 캘린더(있으면) + 프로그래머스 수집 풀이를 합친다.
 * LeetCode 은 전체 기록(제출 수), 프로그래머스는 우리가 집계한 문제 수.
 */
export function combineHeatmap(
  leetcodeCalendar: Record<string, number> | undefined,
  programmersDates: Date[],
  timeZone: string,
): { total: Record<string, number>; breakdown: Record<string, DayBreakdown> } {
  const total: Record<string, number> = {};
  const breakdown: Record<string, DayBreakdown> = {};

  for (const [k, v] of Object.entries(leetcodeCalendar ?? {})) {
    total[k] = (total[k] ?? 0) + v;
    breakdown[k] = { leetcode: v, programmers: 0 };
  }
  for (const date of programmersDates) {
    const { y, mo, d } = parts(date, timeZone);
    const key = String(Math.floor(Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 1000));
    total[key] = (total[key] ?? 0) + 1;
    if (!breakdown[key]) breakdown[key] = { leetcode: 0, programmers: 0 };
    breakdown[key].programmers += 1;
  }
  return { total, breakdown };
}

/** 잔디 통합용: 날짜별 플랫폼별 개수. total 은 색상, breakdown 은 툴팁에 쓴다. */
export function solvesToPlatformCalendar(
  solves: { acceptedAt: Date; platform: string }[],
  timeZone: string,
): { total: Record<string, number>; breakdown: Record<string, DayBreakdown> } {
  const total: Record<string, number> = {};
  const breakdown: Record<string, DayBreakdown> = {};
  for (const s of solves) {
    const { y, mo, d } = parts(s.acceptedAt, timeZone);
    const key = String(Math.floor(Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 1000));
    total[key] = (total[key] ?? 0) + 1;
    if (!breakdown[key]) breakdown[key] = { leetcode: 0, programmers: 0 };
    if (s.platform === "PROGRAMMERS") breakdown[key].programmers += 1;
    else breakdown[key].leetcode += 1;
  }
  return { total, breakdown };
}
