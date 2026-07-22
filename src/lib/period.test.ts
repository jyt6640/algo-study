import { describe, it, expect } from "vitest";
import { currentPeriod, endedPeriods, addDaysStr } from "./week";

const KST = "Asia/Seoul";

describe("addDaysStr", () => {
  it("날짜 더하기", () => {
    expect(addDaysStr("2026-07-20", 3)).toBe("2026-07-23");
    expect(addDaysStr("2026-07-30", 3)).toBe("2026-08-02");
  });
});

describe("currentPeriod (startDate 기준 N일 주기)", () => {
  it("3일 주기: 시작일부터 3일씩", () => {
    const g = { timezone: KST, periodDays: 3, startDate: "2026-07-20", endDate: null };
    // 2026-07-22 12:00 KST = 03:00 UTC → period 0 (07-20~07-23)
    const p = currentPeriod(new Date("2026-07-22T03:00:00Z"), g);
    expect(p.periodOf).toBe("2026-07-20");
    // 07-23 00:00 KST = 07-22 15:00 UTC → period 1
    const p2 = currentPeriod(new Date("2026-07-22T15:00:00Z"), g);
    expect(p2.periodOf).toBe("2026-07-23");
  });

  it("시작 전이면 notStarted", () => {
    const g = { timezone: KST, periodDays: 7, startDate: "2026-08-01", endDate: null };
    const p = currentPeriod(new Date("2026-07-22T03:00:00Z"), g);
    expect(p.notStarted).toBe(true);
  });

  it("종료일 지나면 ended", () => {
    const g = { timezone: KST, periodDays: 7, startDate: "2026-06-01", endDate: "2026-06-30" };
    const p = currentPeriod(new Date("2026-07-22T03:00:00Z"), g);
    expect(p.ended).toBe(true);
  });

  it("startDate 없으면 legacy 주단위(월~일)", () => {
    const g = { timezone: KST, periodDays: 7, startDate: null, endDate: null };
    const p = currentPeriod(new Date("2026-07-22T03:00:00Z"), g);
    expect(p.periodOf).toBe("2026-07-20"); // 월요일
  });
});

describe("endedPeriods", () => {
  it("끝난 기간들만 반환 (진행 중 제외)", () => {
    const g = { timezone: KST, periodDays: 3, startDate: "2026-07-14", endDate: null };
    // 2026-07-22 03:00 UTC (07-22 12:00 KST). periods: 14~17, 17~20, 20~23(진행중)
    const ended = endedPeriods(new Date("2026-07-22T03:00:00Z"), g);
    const labels = ended.map((p) => p.periodOf);
    expect(labels).toContain("2026-07-14");
    expect(labels).toContain("2026-07-17");
    expect(labels).not.toContain("2026-07-20"); // 아직 진행 중
  });
});
