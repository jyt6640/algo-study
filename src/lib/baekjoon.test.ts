import { describe, expect, it } from "vitest";
import { manualSolveSchema } from "./ingestValidation";
import { problemUrl } from "./platform";

describe("백준 직접 등록", () => {
  it.each(["1000", " https://acmicpc.net/problem/1000 ", "https://www.acmicpc.net/problem/1000/"])(
    "문제 번호로 정규화한다 (%s)",
    (problem) => {
      expect(manualSolveSchema.parse({ platform: "BOJ", problem, code: "  own code\n" })).toMatchObject(
        { platform: "BOJ", problem: "1000", code: "  own code\n" },
      );
    },
  );

  it.each(["0", "-1000", "https://acmicpc.net.example.com/problem/1000", "https://acmicpc.net/submit/1000", "https://example.com@acmicpc.net/problem/1000"])(
    "잘못된 번호와 링크를 거절한다 (%s)",
    (problem) => {
      expect(manualSolveSchema.safeParse({ platform: "BOJ", problem }).success).toBe(false);
    },
  );

  it("기존 책 입력을 유지하고 백준 링크를 플랫폼별로 구분한다", () => {
    expect(manualSolveSchema.parse({ title: "  오프라인 문제  " })).toMatchObject({ platform: "BOOK", title: "오프라인 문제" });
    expect(manualSolveSchema.safeParse({ title: "" }).success).toBe(false);
    expect(problemUrl("BOJ", "1000")).toBe("https://acmicpc.net/problem/1000");
    expect(problemUrl("PROGRAMMERS", "1000")).toContain("programmers.co.kr");
    expect(problemUrl("BOOK", "1000")).toBeNull();
  });
});
