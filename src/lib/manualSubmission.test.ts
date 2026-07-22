import { describe, expect, it } from "vitest";
import { parseManualSubmission } from "./manualSubmission";

describe("parseManualSubmission", () => {
  it("returns normalized code and language when a valid manual submission is provided", () => {
    // Given
    const input = { code: "class Solution {}", language: " Java 17 " };

    // When
    const submission = parseManualSubmission(input);

    // Then
    expect(submission).toEqual({ code: "class Solution {}", language: "Java 17" });
  });

  it("rejects a whitespace-only code submission", () => {
    // Given
    const input = { code: "   ", language: "Java" };

    // When / Then
    expect(() => parseManualSubmission(input)).toThrow("코드를 입력하세요.");
  });
});
