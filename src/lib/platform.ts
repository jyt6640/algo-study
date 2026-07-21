export type Platform = "LEETCODE" | "PROGRAMMERS";

/** 플랫폼별 문제 URL */
export function problemUrl(platform: string, slug: string): string {
  if (platform === "PROGRAMMERS") {
    return `https://school.programmers.co.kr/learn/courses/30/lessons/${slug}`;
  }
  return `https://leetcode.com/problems/${slug}/`;
}

export const platformLabel: Record<string, string> = {
  LEETCODE: "LeetCode",
  PROGRAMMERS: "프로그래머스",
};
