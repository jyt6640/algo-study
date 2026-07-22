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

export interface LeetCodeProfile {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  totalSolved: number;
}

const PROFILE_QUERY = `
query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName userAvatar ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
}`;

/** 핸들이 실재하는 계정인지 확인하고 프로필 요약을 반환. 없으면 null. */
export async function fetchUserProfile(username: string): Promise<LeetCodeProfile | null> {
  const res = await fetch(LEETCODE_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
    },
    body: JSON.stringify({ query: PROFILE_QUERY, variables: { username } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LeetCode GQL ${res.status}`);

  const json = (await res.json()) as {
    data?: {
      matchedUser?: {
        username: string;
        profile?: { realName?: string; userAvatar?: string; ranking?: number };
        submitStatsGlobal?: { acSubmissionNum?: Array<{ difficulty: string; count: number }> };
      } | null;
    };
  };

  const u = json.data?.matchedUser;
  if (!u) return null;

  const all = u.submitStatsGlobal?.acSubmissionNum?.find((x) => x.difficulty === "All");
  return {
    username: u.username,
    realName: u.profile?.realName || null,
    avatar: u.profile?.userAvatar || null,
    ranking: u.profile?.ranking ?? null,
    totalSolved: all?.count ?? 0,
  };
}

export interface LeetCodeFullProfile {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  solved: { all: number; easy: number; medium: number; hard: number };
  streak: number;
  totalActiveDays: number;
  /** unix초(UTC 자정) -> 그 날의 제출 수. GitHub 잔디의 데이터 소스. */
  calendar: Record<string, number>;
}

const FULL_QUERY = `
query userFull($username: String!, $y1: Int!, $y2: Int!) {
  matchedUser(username: $username) {
    username
    profile { realName userAvatar ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    cur: userCalendar(year: $y1) { streak totalActiveDays submissionCalendar }
    prev: userCalendar(year: $y2) { submissionCalendar }
  }
}`;

/** 프로필 + 최근 2년 제출 캘린더(잔디용)를 한 번에 조회. 없으면 null. */
export async function fetchFullProfile(username: string): Promise<LeetCodeFullProfile | null> {
  const now = new Date();
  const y1 = now.getUTCFullYear();
  const res = await fetch(LEETCODE_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
    },
    body: JSON.stringify({ query: FULL_QUERY, variables: { username, y1, y2: y1 - 1 } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LeetCode GQL ${res.status}`);

  const json = (await res.json()) as {
    data?: {
      matchedUser?: {
        username: string;
        profile?: { realName?: string; userAvatar?: string; ranking?: number };
        submitStatsGlobal?: { acSubmissionNum?: Array<{ difficulty: string; count: number }> };
        cur?: { streak?: number; totalActiveDays?: number; submissionCalendar?: string } | null;
        prev?: { submissionCalendar?: string } | null;
      } | null;
    };
  };

  const u = json.data?.matchedUser;
  if (!u) return null;

  const num = (d: string) =>
    u.submitStatsGlobal?.acSubmissionNum?.find((x) => x.difficulty === d)?.count ?? 0;

  const parse = (s?: string): Record<string, number> => {
    if (!s) return {};
    try {
      return JSON.parse(s) as Record<string, number>;
    } catch {
      return {};
    }
  };
  const calendar = { ...parse(u.prev?.submissionCalendar), ...parse(u.cur?.submissionCalendar) };

  return {
    username: u.username,
    realName: u.profile?.realName || null,
    avatar: u.profile?.userAvatar || null,
    ranking: u.profile?.ranking ?? null,
    solved: { all: num("All"), easy: num("Easy"), medium: num("Medium"), hard: num("Hard") },
    streak: u.cur?.streak ?? 0,
    totalActiveDays: u.cur?.totalActiveDays ?? 0,
    calendar,
  };
}

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

export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  slug: string;
  title: string;
  difficulty: string; // Easy | Medium | Hard
  url: string;
}

const DAILY_QUERY = `
query questionOfToday {
  activeDailyCodingChallengeQuestion {
    date
    link
    question { title titleSlug difficulty }
  }
}`;

/** 오늘의 LeetCode 데일리 챌린지. 실패하면 null. 1시간 캐시. */
export async function fetchDailyChallenge(): Promise<DailyChallenge | null> {
  try {
    const res = await fetch(LEETCODE_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://leetcode.com/problemset/",
      },
      body: JSON.stringify({ query: DAILY_QUERY }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        activeDailyCodingChallengeQuestion?: {
          date: string;
          link: string;
          question: { title: string; titleSlug: string; difficulty: string };
        };
      };
    };
    const d = json.data?.activeDailyCodingChallengeQuestion;
    if (!d?.question) return null;
    return {
      date: d.date,
      slug: d.question.titleSlug,
      title: d.question.title,
      difficulty: d.question.difficulty,
      url: `https://leetcode.com${d.link}`,
    };
  } catch {
    return null;
  }
}
