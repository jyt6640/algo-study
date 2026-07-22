import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { ManualSubmissionValidationError, parseManualSubmission } from "@/lib/manualSubmission";
import { currentUserId } from "@/lib/session";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "입력 형식이 올바르지 않습니다." }, { status: 400 });
    }
    throw error;
  }

  let submission;
  try {
    submission = parseManualSubmission(body);
  } catch (error) {
    if (error instanceof ManualSubmissionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [solve] = await db
    .select({ ownerId: schema.solveLogs.userId })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.id, parsedSolveId))
    .limit(1);
  if (!solve) return NextResponse.json({ error: "풀이를 찾을 수 없습니다." }, { status: 404 });
  if (solve.ownerId !== userId) return NextResponse.json({ error: "본인 풀이의 코드만 저장할 수 있어요." }, { status: 403 });

  await db
    .insert(schema.submissions)
    .values({
      solveLogId: parsedSolveId,
      language: submission.language,
      code: submission.code,
      submittedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.submissions.solveLogId,
      set: { language: submission.language, code: submission.code, submittedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
