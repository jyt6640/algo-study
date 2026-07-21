import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { previousWeekBounds } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

// 마감 잡(일요일 자정 직후): 방금 끝난 주의 결과를 확정하고 미달자에게 벌금 기록
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const allGroups = await db.select().from(schema.groups);
  const results: Array<{ groupId: number; weekOf: string; finalized: number }> = [];

  for (const group of allGroups) {
    const { start, end, weekOf } = previousWeekBounds(now, group.timezone);

    const members = await db
      .select({ userId: schema.memberships.userId })
      .from(schema.memberships)
      .where(eq(schema.memberships.groupId, group.id));

    let finalized = 0;
    for (const m of members) {
      // 해당 주 기간 내 distinct slug 개수
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
      const met = solved >= group.quota;
      const penalty = calcPenalty(group.penaltyType, group.penaltyAmount, group.quota, solved);

      await db
        .insert(schema.weeklyResults)
        .values({
          userId: m.userId,
          groupId: group.id,
          weekOf,
          solvedCount: solved,
          metQuota: met,
          penaltyAmount: penalty,
        })
        .onConflictDoUpdate({
          target: [schema.weeklyResults.userId, schema.weeklyResults.groupId, schema.weeklyResults.weekOf],
          set: { solvedCount: solved, metQuota: met, penaltyAmount: penalty, finalizedAt: new Date() },
        });
      finalized++;
    }

    results.push({ groupId: group.id, weekOf, finalized });
  }

  return NextResponse.json({ ok: true, results });
}
