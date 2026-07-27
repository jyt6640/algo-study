import { describe, it, expect } from "vitest";
import { proratedQuota } from "./prorate";

const start = new Date("2026-07-19T15:00:00Z"); // 7/20 00:00 KST
const end = new Date("2026-07-26T15:00:00Z");   // 7/27 00:00 KST

describe("proratedQuota (기간 중 가입자 목표 비례)", () => {
  it("기간 시작 전 가입자는 목표 그대로", () => {
    expect(proratedQuota(7, start, end, new Date("2026-07-10T00:00:00Z"))).toBe(7);
    expect(proratedQuota(7, start, end, start)).toBe(7);
  });

  it("기간 둘째 날 가입이면 남은 일수만큼 줄어듦", () => {
    // 실제 가입 2026-07-21T06:40Z → 남은 5.35일 / 7일 → 7 × 0.764 ≈ 5
    expect(proratedQuota(7, start, end, new Date("2026-07-21T06:40:24Z"))).toBe(5);
  });

  it("마감 직전 가입이면 0 (벌금 없음)", () => {
    expect(proratedQuota(7, start, end, new Date("2026-07-26T14:30:00Z"))).toBe(0);
  });

  it("기간 종료 후 가입 시각이면 0", () => {
    expect(proratedQuota(7, start, end, new Date("2026-07-27T00:00:00Z"))).toBe(0);
  });

  it("원래 목표를 넘지 않음", () => {
    expect(proratedQuota(3, start, end, new Date("2026-07-19T16:00:00Z"))).toBeLessThanOrEqual(3);
  });
});
