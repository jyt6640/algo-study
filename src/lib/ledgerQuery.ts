import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** 화면에 한 번에 로드할 기간 수 (LedgerList 는 이 안에서 4개씩 펼친다) */
export const LEDGER_PERIOD_LIMIT = 12;

export type LedgerRow = {
  id: number;
  weekOf: string;
  nickname: string;
  solvedCount: number;
  metQuota: boolean;
  penaltyAmount: number;
  exempt: boolean;
  paid: boolean;
};

/**
 * 벌금 장부: 최근 N개 기간만 읽는다 (전체를 매번 읽으면 멤버×기간으로 무한 증가).
 * 합계는 전 기간을 DB 집계로 구해 정확도를 유지한다.
 */
export async function loadLedger(groupId: number, periodLimit = LEDGER_PERIOD_LIMIT) {
  // 1) 최근 기간 목록 (행이 아니라 기간 단위로 자른다 — 기간이 잘려 보이지 않게)
  const recentPeriods = await db
    .selectDistinct({ weekOf: schema.weeklyResults.weekOf })
    .from(schema.weeklyResults)
    .where(eq(schema.weeklyResults.groupId, groupId))
    .orderBy(desc(schema.weeklyResults.weekOf))
    .limit(periodLimit + 1); // 더 있는지 확인용으로 하나 더

  const hasMore = recentPeriods.length > periodLimit;
  const periods = recentPeriods.slice(0, periodLimit).map((p) => p.weekOf);

  const rows: LedgerRow[] = periods.length
    ? await db
        .select({
          id: schema.weeklyResults.id,
          weekOf: schema.weeklyResults.weekOf,
          nickname: schema.users.nickname,
          solvedCount: schema.weeklyResults.solvedCount,
          metQuota: schema.weeklyResults.metQuota,
          penaltyAmount: schema.weeklyResults.penaltyAmount,
          exempt: schema.weeklyResults.exempt,
          paid: schema.weeklyResults.paid,
        })
        .from(schema.weeklyResults)
        .innerJoin(schema.users, eq(schema.users.id, schema.weeklyResults.userId))
        .where(
          and(
            eq(schema.weeklyResults.groupId, groupId),
            inArray(schema.weeklyResults.weekOf, periods),
          ),
        )
        .orderBy(desc(schema.weeklyResults.weekOf))
    : [];

  // 2) 합계는 전 기간 기준 (읽어온 페이지에만 의존하지 않게 DB 에서 집계)
  const [totals] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.weeklyResults.penaltyAmount}), 0)::int`,
      unpaid: sql<number>`coalesce(sum(case when ${schema.weeklyResults.paid} then 0 else ${schema.weeklyResults.penaltyAmount} end), 0)::int`,
      periodCount: sql<number>`count(distinct ${schema.weeklyResults.weekOf})::int`,
    })
    .from(schema.weeklyResults)
    .where(
      and(
        eq(schema.weeklyResults.groupId, groupId),
        eq(schema.weeklyResults.exempt, false),
        gte(schema.weeklyResults.penaltyAmount, 1),
      ),
    );

  return {
    rows,
    hasMore,
    totalPenalty: totals?.total ?? 0,
    unpaidTotal: totals?.unpaid ?? 0,
    loadedPeriods: periods.length,
  };
}
