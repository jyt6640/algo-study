import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { ManualSubmissionValidationError, parseManualSubmission } from "@/lib/manualSubmission";
import { currentUserId } from "@/lib/session";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

type RouteContext = {
  readonly params: Promise<{ solveId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { solveId } = await params;
  const parsedSolveId = Number(solveId);
  if (!Number.isSafeInteger(parsedSolveId) || parsedSolveId < 1) {
    return NextResponse.json({ error: "풀이를 찾을 수 없습니다." }, { status: 404 });
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });

  let submission;
  try {
    submission = parseManualSubmission(bodyResult.value);
  } catch (error) {
    if (error instanceof ManualSubmissionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [solve] = await db
    .select({ ownerId: schema.solveLogs.userId, platform: schema.solveLogs.platform, slug: schema.solveLogs.problemSlug, acceptedAt: schema.solveLogs.acceptedAt })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.id, parsedSolveId))
    .limit(1);
  if (!solve) return NextResponse.json({ error: "풀이를 찾을 수 없습니다." }, { status: 404 });
  if (solve.ownerId !== userId) return NextResponse.json({ error: "본인 풀이의 코드만 저장할 수 있어요." }, { status: 403 });

  await ensureTransaction(async (tx) => {
    let [event] = await tx
      .select({ id: schema.submissionEvents.id })
      .from(schema.submissionEvents)
      .where(and(eq(schema.submissionEvents.userId, userId), eq(schema.submissionEvents.platform, solve.platform), eq(schema.submissionEvents.problemSlug, solve.slug)))
      .orderBy(desc(schema.submissionEvents.acceptedAt))
      .limit(1);
    if (!event) {
      const created = await appendSubmissionEvent(tx, {
        userId,
        platform: solve.platform,
        problemSlug: solve.slug,
        acceptedAt: solve.acceptedAt,
        source: "LEGACY",
        verificationLevel: "LEGACY",
        eventKey: submissionEventKey({ userId, platform: solve.platform, problemSlug: solve.slug, acceptedAt: solve.acceptedAt, source: "LEGACY" }),
      });
      event = { id: created.eventId };
    }
    await tx.insert(schema.submissionCodeVersions).values({
      eventId: event.id,
      language: submission.language,
      code: submission.code,
      submittedAt: new Date(),
    });
    await tx
      .insert(schema.submissions)
      .values({ solveLogId: parsedSolveId, language: submission.language, code: submission.code, submittedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.submissions.solveLogId,
        set: { language: submission.language, code: submission.code, submittedAt: new Date() },
      });
  });

  return NextResponse.json({ ok: true });
}
