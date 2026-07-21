import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";
import { weekBounds } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";

export const runtime = "nodejs";

// GET — 확장 토큰(Authorization: Bearer)으로 내 현황을 반환.
// 웹 대시보드와 동일한 정보를 확장에서도 볼 수 있게 한다.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!raw) return NextResponse.json({ error: "연동 토큰이 없습니다." }, { status: 401 });

  const [tok] = await db
    .select({ userId: schema.extensionTokens.userId })
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.tokenHash, hashToken(raw)), isNull(schema.extensionTokens.revokedAt)))
    .limit(1);
  if (!tok) return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });

  const userId = tok.userId;

  const [user] = await db
    .select({ nickname: schema.users.nickname, handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  // 내가 속한 그룹들 + 그룹 타임존 기준 이번 주 진행률
  const memberships = await db
    .select({
      groupId: schema.groups.id,
      name: schema.groups.name,
      quota: schema.groups.quota,
      penaltyType: schema.groups.penaltyType,
      penaltyAmount: schema.groups.penaltyAmount,
      timezone: schema.groups.timezone,
    })
    .from(schema.memberships)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.memberships.groupId))
    .where(eq(schema.memberships.userId, userId));

  const studies = await Promise.all(
    memberships.map(async (g) => {
      const { start, end } = weekBounds(new Date(), g.timezone);
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`count(distinct ${schema.solveLogs.problemSlug})::int` })
        .from(schema.solveLogs)
        .where(
          and(
            eq(schema.solveLogs.userId, userId),
            gte(schema.solveLogs.acceptedAt, start),
            lt(schema.solveLogs.acceptedAt, end),
          ),
        );
      const solved = cnt ?? 0;
      return {
        groupId: g.groupId,
        name: g.name,
        quota: g.quota,
        solved,
        met: solved >= g.quota,
        projectedPenalty: calcPenalty(g.penaltyType, g.penaltyAmount, g.quota, solved),
      };
    }),
  );

  // 최근 푼 문제
  const recent = await db
    .select({
      slug: schema.solveLogs.problemSlug,
      title: schema.solveLogs.problemTitle,
      acceptedAt: schema.solveLogs.acceptedAt,
      source: schema.solveLogs.source,
    })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.userId, userId))
    .orderBy(desc(schema.solveLogs.acceptedAt))
    .limit(15);

  return NextResponse.json({
    nickname: user?.nickname ?? null,
    handle: user?.handle ?? null,
    studies,
    recent,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
