/**
 * 주 경계 계산.
 * 규칙: 월요일 00:00 시작 ~ 일요일 24:00(=다음 월요일 00:00) 마감. 그룹 타임존 기준.
 *
 * 타임존 오프셋을 구하기 위해 Intl 로 해당 존의 벽시계 시각을 읽는다.
 */

function tzOffsetMs(date: Date, timeZone: string): number {
  // date(UTC 절대시각)를 timeZone 벽시계로 표현했을 때, 그 벽시계를 UTC로 본 값 - date
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  return asUTC - date.getTime();
}

/** 주어진 시각이 속한 주의 [시작, 마감) 을 UTC Date 로 반환. weekOf 는 시작일의 YYYY-MM-DD(그룹 타임존). */
export function weekBounds(now: Date, timeZone: string): { start: Date; end: Date; weekOf: string } {
  const offset = tzOffsetMs(now, timeZone);
  // 그룹 타임존 벽시계 기준 로컬 시각
  const local = new Date(now.getTime() + offset);
  const dow = local.getUTCDay(); // 0=일 ... 1=월
  const daysSinceMonday = (dow + 6) % 7; // 월=0, 일=6

  // 로컬 벽시계로 이번 주 월요일 00:00
  const localMondayMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
  );
  // 로컬 벽시계 값을 다시 실제 UTC 절대시각으로 변환
  const start = new Date(localMondayMidnight - offset);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekOf = new Date(localMondayMidnight).toISOString().slice(0, 10);
  return { start, end, weekOf };
}

/** 방금 끝난(직전) 주의 경계. 마감 배치가 일요일 자정 직후 실행될 때 사용. */
export function previousWeekBounds(now: Date, timeZone: string) {
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return weekBounds(oneWeekAgo, timeZone);
}
