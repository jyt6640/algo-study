import { NextRequest, NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchRecentAcSubmissions } from "@/lib/leetcode";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

// 수집 잡(시간당): LeetCode 핸들이 등록된 모든 유저의 최근 Accepted 를 폴링해 SolveLog 로 적재
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targets = await db
    .select({ id: schema.users.id, handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(isNotNull(schema.users.leetcodeHandle));

  let inserted = 0;
  const errors: Array<{ handle: string; error: string }> = [];

  for (const u of targets) {
    const handle = u.handle!;
    try {
      const subs = await fetchRecentAcSubmissions(handle, 20);
      for (const s of subs) {
        const res = await db
          .insert(schema.solveLogs)
          .values({
            userId: u.id,
            problemSlug: s.problemSlug,
            problemTitle: s.problemTitle,
            acceptedAt: new Date(s.timestamp * 1000),
            source: "LEETCODE_GQL",
          })
          .onConflictDoNothing({ target: [schema.solveLogs.userId, schema.solveLogs.problemSlug] })
          .returning({ id: schema.solveLogs.id });
        if (res.length) inserted++;
      }
    } catch (e) {
      errors.push({ handle, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, users: targets.length, inserted, errors });
}
