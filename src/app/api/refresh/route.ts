import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { fetchRecentAcSubmissions } from "@/lib/leetcode";

export const runtime = "nodejs";

// 로그인 사용자의 LeetCode 최근 Accepted 를 즉시 폴링해 solveLogs 에 반영.
// (익스텐션 없이도 푼 문제·잔디·활동이 바로 뜨게. 코드는 공개 API 에 없어 미포함)
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const [user] = await db
    .select({ handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user?.handle) {
    return NextResponse.json({ error: "LeetCode가 연동되어 있지 않아요." }, { status: 400 });
  }

  let inserted = 0;
  try {
    const subs = await fetchRecentAcSubmissions(user.handle, 20);
    for (const s of subs) {
      const res = await db
        .insert(schema.solveLogs)
        .values({
          userId,
          platform: "LEETCODE",
          problemSlug: s.problemSlug,
          problemTitle: s.problemTitle,
          acceptedAt: new Date(s.timestamp * 1000),
          source: "LEETCODE_GQL",
        })
        .onConflictDoNothing({
          target: [schema.solveLogs.userId, schema.solveLogs.platform, schema.solveLogs.problemSlug],
        })
        .returning({ id: schema.solveLogs.id });
      if (res.length) inserted++;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "LeetCode 조회 실패" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, inserted });
}
