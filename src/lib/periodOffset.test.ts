import { describe, it, expect } from "vitest";
import { periodByOffset } from "./week";

const weekly = { timezone: "Asia/Seoul", periodDays: 7, startDate: null, endDate: null };
// 2026-08-10(월) 12:00 KST = 03:00 UTC
const now = new Date("2026-08-10T03:00:00Z");

describe("periodByOffset", () => {
  it("offset 0 은 이번 기간", () => {
    expect(periodByOffset(now, weekly, 0).periodOf).toBe("2026-08-10");
  });

  it("offset -1 은 직전 주 (월~일 유지)", () => {
    const p = periodByOffset(now, weekly, -1);
    expect(p.periodOf).toBe("2026-08-03");
    expect(p.start.toISOString()).toBe("2026-08-02T15:00:00.000Z"); // 8/3 00:00 KST
    expect(p.end.toISOString()).toBe("2026-08-09T15:00:00.000Z"); // 8/10 00:00 KST
  });

  it("여러 주 전도 정확", () => {
    expect(periodByOffset(now, weekly, -3).periodOf).toBe("2026-07-20");
  });

  it("N일 주기(startDate 기준)도 주기만큼 이동", () => {
    const g = { timezone: "Asia/Seoul", periodDays: 3, startDate: "2026-08-01", endDate: null };
    const cur = periodByOffset(now, g, 0);
    const prev = periodByOffset(now, g, -1);
    const diff = (cur.start.getTime() - prev.start.getTime()) / 86400000;
    expect(diff).toBe(3);
  });

  it("시작일 이전 기간은 notStarted", () => {
    const g = { timezone: "Asia/Seoul", periodDays: 7, startDate: "2026-08-10", endDate: null };
    expect(periodByOffset(now, g, -1).notStarted).toBe(true);
  });
});
