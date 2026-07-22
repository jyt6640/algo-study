import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { endedPeriods } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { sendDiscord } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

// 마감 잡(매일): 각 스터디의 끝난 기간 중 아직 확정되지 않은 것을 모두 마감·벌금 확정.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const allGroups = await db.select().from(schema.groups).where(eq(schema.groups.active, true));
  const results: Array<{ groupId: number; periodOf: string; finalized: number }> = [];

  for (const group of allGroups) {
    const members = await db
      .select({ userId: schema.memberships.userId, nickname: schema.users.nickname })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.groupId, group.id));
    if (members.length === 0) continue;

    // 이미 확정된 기간(weekOf) 집합
    const done = new Set(
      (
        await db
          .select({ weekOf: schema.weeklyResults.weekOf })
          .from(schema.weeklyResults)
          .where(eq(schema.weeklyResults.groupId, group.id))
      ).map((r) => r.weekOf),
    );

    // 끝났지만 아직 확정 안 된 기간만 (마지막 몇 개로 제한: 안전상 최근 4개)
    const pending = endedPeriods(now, group)
      .filter((p) => !done.has(p.periodOf))
      .slice(-4);

    for (const period of pending) {
      let finalized = 0;
      const summary: string[] = [];
      for (const m of members) {
        const [{ cnt }] = await db
          .select({ cnt: sql<number>`count(distinct ${schema.solveLogs.problemSlug})::int` })
          .from(schema.solveLogs)
          .where(
            and(
              eq(schema.solveLogs.userId, m.userId),
              gte(schema.solveLogs.acceptedAt, period.start),
              lt(schema.solveLogs.acceptedAt, period.end),
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
            weekOf: period.periodOf,
            solvedCount: solved,
            metQuota: met,
            penaltyAmount: penalty,
          })
          .onConflictDoUpdate({
            target: [schema.weeklyResults.userId, schema.weeklyResults.groupId, schema.weeklyResults.weekOf],
            set: { solvedCount: solved, metQuota: met, penaltyAmount: penalty, finalizedAt: new Date() },
          });
        finalized++;
        summary.push(
          met
            ? `✅ ${m.nickname} — ${solved}/${group.quota} 달성`
            : `❌ ${m.nickname} — ${solved}/${group.quota} · 벌금 ${penalty.toLocaleString()}원`,
        );
      }

      if (group.discordWebhook && summary.length) {
        await sendDiscord(
          group.discordWebhook,
          `📊 **${group.name}** ${period.periodOf} 기간 마감 결과\n${summary.join("\n")}`,
        );
      }
      results.push({ groupId: group.id, periodOf: period.periodOf, finalized });
    }
  }

  return NextResponse.json({ ok: true, results });
}
