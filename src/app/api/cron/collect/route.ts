import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchRecentAcSubmissions } from "@/lib/leetcode";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { sendDiscord, isLastDayOfWeek } from "@/lib/notify";
import { weekBounds } from "@/lib/week";

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
      errors.push({ handle, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 마감 당일(일요일)이면, 웹훅이 있는 그룹에 진행 상황 리마인더 전송
  let reminded = 0;
  const now = new Date();
  const groups = await db
    .select()
    .from(schema.groups)
    .where(isNotNull(schema.groups.discordWebhook));
  for (const g of groups) {
    if (!g.discordWebhook || !isLastDayOfWeek(now, g.timezone)) continue;
    const { start, end } = weekBounds(now, g.timezone);
    const members = await db
      .select({ nickname: schema.users.nickname, userId: schema.memberships.userId })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.groupId, g.id));

    const behind: string[] = [];
    for (const m of members) {
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`count(distinct ${schema.solveLogs.problemSlug})::int` })
        .from(schema.solveLogs)
        .where(
          and(
            eq(schema.solveLogs.userId, m.userId),
            gte(schema.solveLogs.acceptedAt, start),
            lt(schema.solveLogs.acceptedAt, end),
          ),
        );
      const solved = cnt ?? 0;
      if (solved < g.quota) behind.push(`• ${m.nickname} — ${solved}/${g.quota} (${g.quota - solved}개 남음)`);
    }
    if (behind.length) {
      await sendDiscord(
        g.discordWebhook,
        `⏰ **${g.name}** 오늘 자정 마감! 아직 목표 미달인 분들:\n${behind.join("\n")}`,
      );
      reminded++;
    }
  }

  return NextResponse.json({ ok: true, users: targets.length, inserted, reminded, errors });
}
