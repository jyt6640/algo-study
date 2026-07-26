import { describe, it, expect } from "vitest";
import { fmtPeriodRange, fmtDayLabel } from "./format";

describe("fmtPeriodRange (월~일 주 단위)", () => {
  it("7일 기간은 월요일 시작 ~ 일요일 끝으로 표시", () => {
    expect(fmtPeriodRange("2026-07-20", 7)).toBe("7월 20일(월) ~ 26일(일)");
  });

  it("직전 주도 월~일", () => {
    expect(fmtPeriodRange("2026-07-13", 7)).toBe("7월 13일(월) ~ 19일(일)");
  });

  it("월을 넘어가면 양쪽 월 표기", () => {
    expect(fmtPeriodRange("2026-07-27", 7)).toBe("7월 27일(월) ~ 8월 2일(일)");
  });

  it("3일 주기도 정확히 마지막 날 포함", () => {
    expect(fmtPeriodRange("2026-07-20", 3)).toBe("7월 20일(월) ~ 22일(수)");
  });

  it("하루 주기는 같은 날", () => {
    expect(fmtPeriodRange("2026-07-20", 1)).toBe("7월 20일(월) ~ 20일(월)");
  });

  it("fmtDayLabel 은 요일 포함", () => {
    expect(fmtDayLabel("2026-07-26")).toBe("7월 26일(일)");
  });
});
