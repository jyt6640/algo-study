import { describe, it, expect } from "vitest";
import { fmtDateTime, fmtDate, solvesToCalendar, solvesToPlatformCalendar, combineHeatmap } from "./format";

const KST = "Asia/Seoul";

describe("fmtDate / fmtDateTime (그룹 타임존)", () => {
  it("UTC 를 KST 로 변환", () => {
    // 2026-07-21 17:30 UTC = 2026-07-22 02:30 KST
    const d = new Date("2026-07-21T17:30:00Z");
    expect(fmtDate(d, KST)).toBe("2026-07-22");
    expect(fmtDateTime(d, KST)).toBe("7/22 02:30");
  });
});

describe("solvesToCalendar", () => {
  it("같은 날 여러 풀이는 개수로 합산 (KST 기준)", () => {
    const dates = [
      new Date("2026-07-21T01:00:00Z"), // KST 10:00 21일
      new Date("2026-07-21T05:00:00Z"), // KST 14:00 21일
      new Date("2026-07-20T20:00:00Z"), // KST 05:00 21일
    ];
    const cal = solvesToCalendar(dates, KST);
    const key = String(Math.floor(Date.UTC(2026, 6, 21) / 1000));
    expect(cal[key]).toBe(3);
  });
});

describe("solvesToPlatformCalendar / combineHeatmap", () => {
  it("플랫폼별로 나눠 집계", () => {
    const solves = [
      { acceptedAt: new Date("2026-07-21T01:00:00Z"), platform: "LEETCODE" },
      { acceptedAt: new Date("2026-07-21T02:00:00Z"), platform: "PROGRAMMERS" },
      { acceptedAt: new Date("2026-07-21T03:00:00Z"), platform: "PROGRAMMERS" },
    ];
    const { total, breakdown } = solvesToPlatformCalendar(solves, KST);
    const key = String(Math.floor(Date.UTC(2026, 6, 21) / 1000));
    expect(total[key]).toBe(3);
    expect(breakdown[key]).toEqual({ leetcode: 1, programmers: 2 });
  });

  it("combineHeatmap: LeetCode 캘린더 + 프로그래머스 날짜 병합", () => {
    const key = String(Math.floor(Date.UTC(2026, 6, 21) / 1000));
    const lc = { [key]: 4 };
    const pgDates = [new Date("2026-07-21T02:00:00Z")];
    const { total, breakdown } = combineHeatmap(lc, pgDates, KST);
    expect(total[key]).toBe(5);
    expect(breakdown[key]).toEqual({ leetcode: 4, programmers: 1 });
  });
});
