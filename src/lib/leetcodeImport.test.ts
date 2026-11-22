import { describe, expect, it } from "vitest";
import { findLeetCodeCode } from "./leetcodeImport";

describe("findLeetCodeCode", () => {
  it("finds usable code for the open problem even if its newest submission has no code", () => {
    const saved = { slug: "two-sum", code: "  return [];", language: "JavaScript" };

    expect(findLeetCodeCode([
      { slug: "other-problem", code: "return 1;" },
      { slug: "two-sum", code: " " },
      saved,
    ], "two-sum")).toEqual(saved);
  });

  it("returns no submission when only other problems have code", () => {
    expect(findLeetCodeCode([
      { slug: "two-sum", code: "" },
      { slug: "other-problem", code: "return 1;" },
    ], "two-sum")).toBeUndefined();
  });
});
