import { describe, it, expect } from "vitest";
import { calcPenalty } from "./penalty";

describe("calcPenalty", () => {
  it("목표 달성 시 벌금 0", () => {
    expect(calcPenalty("FIXED", 10000, 7, 7)).toBe(0);
    expect(calcPenalty("FIXED", 10000, 7, 9)).toBe(0);
    expect(calcPenalty("PER_MISSING", 3000, 7, 7)).toBe(0);
  });

  it("FIXED: 미달이면 고정 금액", () => {
    expect(calcPenalty("FIXED", 10000, 7, 0)).toBe(10000);
    expect(calcPenalty("FIXED", 10000, 7, 6)).toBe(10000);
  });

  it("PER_MISSING: 부족한 문제 수 × 단가", () => {
    expect(calcPenalty("PER_MISSING", 3000, 7, 5)).toBe(6000); // 2개 부족
    expect(calcPenalty("PER_MISSING", 3000, 7, 0)).toBe(21000); // 7개 부족
    expect(calcPenalty("PER_MISSING", 3000, 7, 6)).toBe(3000); // 1개 부족
  });
});
