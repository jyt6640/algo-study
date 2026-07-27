import { and, asc, eq, gte, lte, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { endedPeriods } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { sendDiscord } from "@/lib/notify";
import { ensureTransaction, type LedgerTransaction } from "@/lib/ledger";
import { proratedQuota } from "@/lib/prorate";

export const runtime = "nodejs";
export const maxDuration = 60;

type Participant = { readonly userId: number; readonly nickname: string; readonly joinedAt: Date };

async function participantsForPeriod(
  tx: LedgerTransaction,
  groupId: number,
  startAt: Date,
  endAt: Date,
): Promise<Participant[]> {
  const current = await tx
    .select({
      userId: schema.memberships.userId,
      nickname: schema.users.nickname,
      joinedAt: schema.memberships.joinedAt,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId));
  const lifecycle = await tx
    .select({
      userId: schema.membershipEvents.userId,
      type: schema.membershipEvents.type,
      effectiveAt: schema.membershipEvents.effectiveAt,
    })
    .from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.groupId, groupId), lte(schema.membershipEvents.effectiveAt, endAt)))
    .orderBy(asc(schema.membershipEvents.effectiveAt), asc(schema.membershipEvents.id));

  const currentByUser = new Map(current.map((member) => [member.userId, member]));
  const eventUsers = new Set(lifecycle.map((event) => event.userId));
  const userIds = new Set([...currentByUser.keys(), ...eventUsers]);
  const names = new Map(current.map((member) => [member.userId, member.nickname]));
  for (const event of lifecycle) {
    if (!names.has(event.userId)) {
      const [user] = await tx.select({ nickname: schema.users.nickname }).from(schema.users).where(eq(schema.users.id, event.userId)).limit(1);
      if (user) names.set(event.userId, user.nickname);
    }
  }

  const byUser = new Map<number, typeof lifecycle>();
  for (const event of lifecycle) {
    const events = byUser.get(event.userId) ?? [];
    events.push(event);
    byUser.set(event.userId, events);
  }

  // 가입 시각: 현재 멤버십의 joined_at 과 최초 JOINED 이벤트 중 이른 쪽
  const joinedAtOf = (userId: number): Date | null => {
    const events = byUser.get(userId) ?? [];
    const firstJoinEvent = events.find((event) => event.type === "JOINED")?.effectiveAt ?? null;
    const membershipJoin = currentByUser.get(userId)?.joinedAt ?? null;
    const candidates = [firstJoinEvent, membershipJoin].filter((d): d is Date => Boolean(d));
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (a < b ? a : b));
  };

  return [...userIds]
    .map((userId) => ({ userId, joinedAt: joinedAtOf(userId) }))
    .filter((candidate): candidate is { userId: number; joinedAt: Date } => {
      if (!candidate.joinedAt) return false;
      // 기간이 끝난 뒤 가입했으면 이 기간과 무관
      if (candidate.joinedAt >= endAt) return false;
      // 기간 시작 전에 이미 나갔으면 제외 (기간 중 탈퇴는 그 기간까지 인정)
      const events = byUser.get(candidate.userId) ?? [];
      const lastBeforeStart = [...events].reverse().find((event) => event.effectiveAt <= startAt);
      if (lastBeforeStart && lastBeforeStart.type !== "JOINED" && lastBeforeStart.type !== "RESUMED") return false;
      // 더 이상 멤버가 아니고 가입 이력도 없으면 제외
      return currentByUser.has(candidate.userId) || events.length > 0;
    })
    .map(({ userId, joinedAt }) => ({
      userId,
      nickname: names.get(userId) ?? `user-${userId}`,
      joinedAt,
    }));
}

async function finalizePeriod(group: typeof schema.groups.$inferSelect, period: { start: Date; end: Date; periodOf: string }) {
  const outcome = await ensureTransaction(async (tx) => {
    const inserted = await tx
      .insert(schema.studyPeriods)
      .values({
        groupId: group.id,
        periodOf: period.periodOf,
        startAt: period.start,
        endAt: period.end,
        quota: group.quota,
        penaltyType: group.penaltyType,
        penaltyAmount: group.penaltyAmount,
        timezone: group.timezone,
      })
      .onConflictDoNothing({ target: [schema.studyPeriods.groupId, schema.studyPeriods.periodOf] })
      .returning({ id: schema.studyPeriods.id });
    let periodId = inserted[0]?.id;
    if (!periodId) {
      const [existing] = await tx
        .select({ id: schema.studyPeriods.id, status: schema.studyPeriods.status })
        .from(schema.studyPeriods)
        .where(and(eq(schema.studyPeriods.groupId, group.id), eq(schema.studyPeriods.periodOf, period.periodOf)))
        .limit(1);
      if (!existing || existing.status === "FINALIZED") return { finalized: false, summary: [] as string[] };
      periodId = existing.id;
    }

    const locked = await tx
      .update(schema.studyPeriods)
      .set({ status: "FINALIZING" })
      .where(and(eq(schema.studyPeriods.id, periodId), eq(schema.studyPeriods.status, "OPEN")))
      .returning({ id: schema.studyPeriods.id });
    if (locked.length === 0) return { finalized: false, summary: [] as string[] };

    const [snapshot] = await tx
      .select()
      .from(schema.studyPeriods)
      .where(eq(schema.studyPeriods.id, periodId))
      .limit(1);
    if (!snapshot) throw new Error("period snapshot was not persisted");

    const participants = await participantsForPeriod(tx, group.id, snapshot.startAt, snapshot.endAt);
    for (const participant of participants) {
      await tx
        .insert(schema.periodParticipants)
        .values({ periodId, userId: participant.userId })
        .onConflictDoNothing({ target: [schema.periodParticipants.periodId, schema.periodParticipants.userId] });
    }

    const summary: string[] = [];
    for (const participant of participants) {
      const events = await tx
        .select({ platform: schema.submissionEvents.platform, slug: schema.submissionEvents.problemSlug })
        .from(schema.submissionEvents)
        .where(
          and(
            eq(schema.submissionEvents.userId, participant.userId),
            gte(schema.submissionEvents.acceptedAt, snapshot.startAt),
            lt(schema.submissionEvents.acceptedAt, snapshot.endAt),
            or(
              eq(schema.submissionEvents.verificationLevel, "SERVER_VERIFIED"),
              eq(schema.submissionEvents.verificationLevel, "EXTENSION_VERIFIED"),
              eq(schema.submissionEvents.verificationLevel, "LEGACY"),
              // 책·오프라인 문제 직접 기입도 목표 개수에 포함 (대시보드 집계와 동일)
              eq(schema.submissionEvents.verificationLevel, "MANUAL_PENDING"),
            ),
          ),
      );
      const solved = new Set(events.map((event) => `${event.platform}:${event.slug}`)).size;
      // 기간 중 가입자는 남은 일수만큼 목표를 비례 적용
      const effectiveQuota = proratedQuota(snapshot.quota, snapshot.startAt, snapshot.endAt, participant.joinedAt);
      const met = solved >= effectiveQuota;
      const penalty = calcPenalty(snapshot.penaltyType, snapshot.penaltyAmount, effectiveQuota, solved);
      await tx
        .insert(schema.periodResults)
        .values({ periodId, userId: participant.userId, solvedCount: solved, metQuota: met, penaltyAmount: penalty })
        .onConflictDoNothing({ target: [schema.periodResults.periodId, schema.periodResults.userId] });
      // 화면이 읽는 레거시 장부에도 반드시 반영 (재시도 시에도 누락되지 않게)
      await tx
        .insert(schema.weeklyResults)
        .values({
          userId: participant.userId,
          groupId: group.id,
          weekOf: period.periodOf,
          solvedCount: solved,
          metQuota: met,
          penaltyAmount: penalty,
        })
        .onConflictDoNothing({ target: [schema.weeklyResults.userId, schema.weeklyResults.groupId, schema.weeklyResults.weekOf] });
      summary.push(
          met
          ? `✅ ${participant.nickname} — ${solved}/${effectiveQuota} 달성`
          : `❌ ${participant.nickname} — ${solved}/${effectiveQuota} · 벌금 ${penalty.toLocaleString()}원`,
      );
    }

    await tx
      .update(schema.studyPeriods)
      .set({ status: "FINALIZED", finalizedAt: new Date() })
      .where(eq(schema.studyPeriods.id, periodId));
    return { finalized: true, summary };
  });

  if (outcome.finalized && group.discordWebhook && outcome.summary.length) {
    await sendDiscord(group.discordWebhook, `📊 **${group.name}** ${period.periodOf} 기간 마감 결과\n${outcome.summary.join("\n")}`);
  }
  return outcome.finalized;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const allGroups = await db.select().from(schema.groups).where(eq(schema.groups.active, true));
  const results: Array<{ readonly groupId: number; readonly periodOf: string; readonly finalized: boolean }> = [];
  for (const group of allGroups) {
    const pending = endedPeriods(now, group).slice(-4);
    for (const period of pending) {
      const finalized = await finalizePeriod(group, period);
      results.push({ groupId: group.id, periodOf: period.periodOf, finalized });
    }
  }
  return NextResponse.json({ ok: true, results });
}
