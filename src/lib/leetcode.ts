/**
 * LeetCode 비공식 GraphQL 어댑터 (경로 ①: 서버 폴링).
 * 공식 공개 API가 없으므로 recentAcSubmissionList 를 사용한다.
 * 언제든 스펙이 바뀔 수 있으니 이 파일 하나로 격리한다.
 */

const LEETCODE_GQL = "https://leetcode.com/graphql";

export interface RecentAcSubmission {
  problemSlug: string;
  problemTitle: string;
  /** 초 단위 epoch (LeetCode 는 문자열 초를 준다) */
  timestamp: number;
}

const RECENT_AC_QUERY = `
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    title
    titleSlug
    timestamp
  }
}`;

export async function fetchRecentAcSubmissions(
  username: string,
  limit = 20,
): Promise<RecentAcSubmission[]> {
  const res = await fetch(LEETCODE_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 일부 지역에서 UA/Referer 없으면 차단되므로 채워준다
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
    },
    body: JSON.stringify({
      query: RECENT_AC_QUERY,
      variables: { username, limit },
    }),
    // 폴링이므로 캐시 금지
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`LeetCode GQL ${res.status} for ${username}`);
  }

  const json = (await res.json()) as {
    data?: { recentAcSubmissionList?: Array<{ title: string; titleSlug: string; timestamp: string }> };
    errors?: unknown;
  };

  const list = json.data?.recentAcSubmissionList;
  if (!list) return [];

  return list.map((s) => ({
    problemSlug: s.titleSlug,
    problemTitle: s.title,
    timestamp: Number(s.timestamp),
  }));
}
