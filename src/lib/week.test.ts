import { describe, it, expect } from "vitest";
import { weekBounds, previousWeekBounds } from "./week";

const KST = "Asia/Seoul";

describe("weekBounds (Asia/Seoul, 월 00:00 ~ 일 24:00)", () => {
  it("수요일이 속한 주는 그 주 월요일에 시작", () => {
    // 2026-07-22 (수) 12:00 KST = 03:00 UTC
    const now = new Date("2026-07-22T03:00:00Z");
    const { start, end, weekOf } = weekBounds(now, KST);
    expect(weekOf).toBe("2026-07-20"); // 월요일
    // start 는 2026-07-20 00:00 KST = 2026-07-19 15:00 UTC
    expect(start.toISOString()).toBe("2026-07-19T15:00:00.000Z");
    // end 는 7일 뒤 (다음 월요일 00:00 KST)
    expect(end.toISOString()).toBe("2026-07-26T15:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("일요일 밤도 같은 주에 포함", () => {
    // 2026-07-26 는 일요일. 23:00 KST = 14:00 UTC
    const sundayNight = new Date("2026-07-26T14:00:00Z");
    const { weekOf } = weekBounds(sundayNight, KST);
    expect(weekOf).toBe("2026-07-20");
  });

  it("월요일 00:00 KST 는 새 주의 시작", () => {
    // 2026-07-27 00:00 KST = 2026-07-26 15:00 UTC
    const monday = new Date("2026-07-26T15:00:00Z");
    const { weekOf } = weekBounds(monday, KST);
    expect(weekOf).toBe("2026-07-27");
  });

  it("previousWeekBounds 는 직전 주", () => {
    const now = new Date("2026-07-22T03:00:00Z");
    const { weekOf } = previousWeekBounds(now, KST);
    expect(weekOf).toBe("2026-07-13");
  });
});
