import { describe, it, expect } from "vitest";
import { splitHighlightedLines } from "./highlightLines";

describe("splitHighlightedLines", () => {
  it("단순 텍스트를 줄 단위로 자른다", () => {
    expect(splitHighlightedLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("한 줄 안의 span 은 그대로 유지", () => {
    expect(splitHighlightedLines('<span class="k">int</span> x;')).toEqual(['<span class="k">int</span> x;']);
  });

  it("여러 줄에 걸친 span 은 줄마다 닫고 다시 연다", () => {
    const out = splitHighlightedLines('<span class="c">/* a\nb */</span>x');
    expect(out).toEqual(['<span class="c">/* a</span>', '<span class="c">b */</span>x']);
  });

  it("중첩 span 도 각 줄에서 균형을 맞춘다", () => {
    const out = splitHighlightedLines('<span class="a"><span class="b">1\n2</span></span>');
    expect(out).toEqual([
      '<span class="a"><span class="b">1</span></span>',
      '<span class="a"><span class="b">2</span></span>',
    ]);
  });

  it("이스케이프된 꺾쇠는 텍스트로 취급", () => {
    expect(splitHighlightedLines("List&lt;String&gt;\nx")).toEqual(["List&lt;String&gt;", "x"]);
  });
});
