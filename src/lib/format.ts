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
