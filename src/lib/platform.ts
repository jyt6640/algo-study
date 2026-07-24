export type Platform = "LEETCODE" | "PROGRAMMERS" | "BOOK";

/** 플랫폼별 문제 URL. 외부 링크가 없는 직접 입력(BOOK)은 null. */
export function problemUrl(platform: string, slug: string): string | null {
  if (platform === "BOOK") return null;
  if (platform === "PROGRAMMERS") {
    return `https://school.programmers.co.kr/learn/courses/30/lessons/${slug}`;
  }
  return `https://leetcode.com/problems/${slug}/`;
}

export const platformLabel: Record<string, string> = {
  LEETCODE: "LeetCode",
  PROGRAMMERS: "프로그래머스",
  BOOK: "책·기타",
};

/** 제목으로 직접 입력 문제의 slug 생성 (같은 제목이면 같은 문제로 취급) */
export function bookSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[/\\?&#%]/g, "")
    .slice(0, 180);
  return `book-${base || Date.now().toString(36)}`;
}
