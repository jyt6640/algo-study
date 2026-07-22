// Discord 웹훅 알림. 그룹별 webhook 이 있을 때만 보낸다.

export async function sendDiscord(webhook: string, content: string): Promise<void> {
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
  } catch {
    /* 알림 실패는 무시 */
  }
}

/** 그룹 타임존 기준 오늘이 일요일(주 마지막 날)인지 */
export function isLastDayOfWeek(now: Date, timeZone: string): boolean {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  return wd === "Sun";
}
