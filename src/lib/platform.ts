export const platforms = ["LEETCODE", "PROGRAMMERS", "BOOK", "BOJ"] as const;
export type Platform = (typeof platforms)[number];

const bojNumber = /^[1-9]\d{0,9}$/;

export function baekjoonProblemNumber(input: string): string | null {
  const value = input.trim();
  if (bojNumber.test(value)) return value;
  const url = URL.canParse(value) ? new URL(value) : null;
  if (!url || url.protocol !== "https:" || url.port || url.username || url.password) return null;
  if (url.hostname !== "acmicpc.net" && url.hostname !== "www.acmicpc.net") return null;
  return url.pathname.match(/^\/problem\/([1-9]\d{0,9})\/?$/)?.[1] ?? null;
}

/** 플랫폼별 문제 URL. 외부 링크가 없는 직접 입력(BOOK)은 null. */
export function problemUrl(platform: Platform, slug: string): string | null {
  if (platform === "BOOK") return null;
  if (platform === "BOJ") return bojNumber.test(slug) ? `https://acmicpc.net/problem/${slug}` : null;
  if (platform === "PROGRAMMERS") {
    return `https://school.programmers.co.kr/learn/courses/30/lessons/${slug}`;
  }
  return `https://leetcode.com/problems/${slug}/`;
}

export const platformLabel: Record<Platform, string> = {
  LEETCODE: "LeetCode",
  PROGRAMMERS: "프로그래머스",
  BOOK: "책·기타",
  BOJ: "백준",
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
