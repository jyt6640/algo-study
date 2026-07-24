import { and, eq, type ExtractTablesWithRelations } from "drizzle-orm";
import type { NeonTransaction } from "drizzle-orm/neon-serverless";
import { db, schema } from "@/db";

export type LedgerTransaction = NeonTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type LedgerSubmissionInput = {
  readonly userId: number;
  readonly platform: "LEETCODE" | "PROGRAMMERS" | "BOOK";
  readonly problemSlug: string;
  readonly problemTitle?: string | null;
  /** 직접 기입(책 등) 문제의 본문 */
  readonly description?: string | null;
  readonly difficulty?: string | null;
  readonly acceptedAt: Date;
  readonly source: "CRON" | "EXTENSION" | "IMPORT" | "MANUAL" | "LEGACY";
  readonly verificationLevel:
    | "SERVER_VERIFIED"
    | "EXTENSION_VERIFIED"
    | "IMPORTED"
    | "MANUAL_PENDING"
    | "LEGACY";
  readonly eventKey: string;
  readonly providerSubmissionId?: string | null;
  readonly code?: string | null;
  readonly language?: string | null;
};

export async function appendSubmissionEvent(
  tx: LedgerTransaction,
  input: LedgerSubmissionInput,
): Promise<{ readonly eventId: number; readonly solveId: number; readonly isNew: boolean; readonly codeSaved: boolean }> {
  // 취소(삭제)된 풀이 처리:
  //  - 자동 재수집(CRON 폴링 / IMPORT 대량 가져오기)은 되살리지 않고 그대로 무시
  //  - 사용자가 직접(EXTENSION 실시간 재풀이 / MANUAL·LEGACY 수동)이면 제외를 해제하고 정상 등록
  const [excluded] = await tx
    .select({ id: schema.excludedSolves.id })
    .from(schema.excludedSolves)
    .where(
      and(
        eq(schema.excludedSolves.userId, input.userId),
        eq(schema.excludedSolves.platform, input.platform),
        eq(schema.excludedSolves.problemSlug, input.problemSlug),
      ),
    )
    .limit(1);
  if (excluded) {
    const isAutomatic = input.source === "CRON" || input.source === "IMPORT";
    if (isAutomatic) {
      return { eventId: 0, solveId: 0, isNew: false, codeSaved: false };
    }
    await tx.delete(schema.excludedSolves).where(eq(schema.excludedSolves.id, excluded.id));
  }

  const receivedAt = new Date();
  const insertedEvent = await tx
    .insert(schema.submissionEvents)
    .values({
      userId: input.userId,
      platform: input.platform,
      problemSlug: input.problemSlug,
      problemTitle: input.problemTitle ?? null,
      difficulty: input.difficulty ?? null,
      acceptedAt: input.acceptedAt,
      receivedAt,
      source: input.source,
      verificationLevel: input.verificationLevel,
      providerSubmissionId: input.providerSubmissionId ?? null,
      eventKey: input.eventKey,
    })
    .onConflictDoNothing({ target: schema.submissionEvents.eventKey })
    .returning({ id: schema.submissionEvents.id });

  let eventId = insertedEvent[0]?.id;
  const isNew = insertedEvent.length > 0;
  if (!eventId) {
    const [existingEvent] = await tx
      .select({ id: schema.submissionEvents.id })
      .from(schema.submissionEvents)
      .where(eq(schema.submissionEvents.eventKey, input.eventKey))
      .limit(1);
    eventId = existingEvent?.id;
  }
  if (!eventId) throw new Error("submission event was not persisted");

  const insertedSolve = await tx
    .insert(schema.solveLogs)
    .values({
      userId: input.userId,
      platform: input.platform,
      problemSlug: input.problemSlug,
      problemTitle: input.problemTitle ?? null,
      description: input.description ?? null,
      difficulty: input.difficulty ?? null,
      acceptedAt: input.acceptedAt,
      source: input.source === "CRON" ? "LEETCODE_GQL" : input.source === "MANUAL" ? "MANUAL" : "EXTENSION",
    })
    .onConflictDoNothing({
      target: [schema.solveLogs.userId, schema.solveLogs.platform, schema.solveLogs.problemSlug],
    })
    .returning({ id: schema.solveLogs.id });

  let solveId = insertedSolve[0]?.id;
  if (!solveId) {
    const [existingSolve] = await tx
      .select({ id: schema.solveLogs.id })
      .from(schema.solveLogs)
      .where(
        and(
          eq(schema.solveLogs.userId, input.userId),
          eq(schema.solveLogs.platform, input.platform),
          eq(schema.solveLogs.problemSlug, input.problemSlug),
        ),
      )
      .limit(1);
    solveId = existingSolve?.id;
  }
  if (!solveId) throw new Error("legacy solve projection was not persisted");

  let codeSaved = false;
  if (input.code) {
    const [existingCode] = await tx
      .select({ id: schema.submissionCodeVersions.id })
      .from(schema.submissionCodeVersions)
      .where(
        and(
          eq(schema.submissionCodeVersions.eventId, eventId),
          eq(schema.submissionCodeVersions.code, input.code),
        ),
      )
      .limit(1);
    if (!existingCode) {
      await tx.insert(schema.submissionCodeVersions).values({
        eventId,
        language: input.language ?? null,
        code: input.code,
        submittedAt: input.acceptedAt,
      });
    }
    await tx
      .insert(schema.submissions)
      .values({
        solveLogId: solveId,
        language: input.language ?? null,
        code: input.code,
        submittedAt: input.acceptedAt,
      })
      .onConflictDoUpdate({
        target: schema.submissions.solveLogId,
        set: { language: input.language ?? null, code: input.code, submittedAt: input.acceptedAt },
      });
    codeSaved = true;
  }

  return { eventId, solveId, isNew, codeSaved };
}

export function submissionEventKey(input: {
  readonly userId: number;
  readonly platform: "LEETCODE" | "PROGRAMMERS" | "BOOK";
  readonly problemSlug: string;
  readonly acceptedAt: Date;
  readonly source: string;
  readonly providerSubmissionId?: string | null;
}): string {
  return [
    input.userId,
    input.platform,
    input.problemSlug,
    input.source,
    input.providerSubmissionId ?? input.acceptedAt.toISOString(),
  ].join(":");
}

export async function appendMembershipEvent(
  tx: LedgerTransaction,
  input: {
    readonly groupId: number;
    readonly userId: number;
    readonly type: "JOINED" | "LEFT" | "KICKED" | "PAUSED" | "RESUMED";
    readonly effectiveAt: Date;
    readonly actorUserId?: number | null;
  },
): Promise<void> {
  await tx.insert(schema.membershipEvents).values({
    groupId: input.groupId,
    userId: input.userId,
    type: input.type,
    effectiveAt: input.effectiveAt,
    actorUserId: input.actorUserId ?? null,
  });
}

export async function ensureTransaction<T>(callback: (tx: LedgerTransaction) => Promise<T>): Promise<T> {
  return db.transaction(callback);
}
