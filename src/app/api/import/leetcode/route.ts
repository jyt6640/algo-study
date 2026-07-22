import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";
import { importPayloadSchema, readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

// 웹 세션 기반 LeetCode 코드 일괄 저장 (확장 bridge 가 LeetCode 세션으로 가져온 코드를 넘겨줌).
// body: { problems: [{ slug, title, acceptedAt, code, language }] }
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = importPayloadSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  const result = await ensureTransaction(async (tx) => {
    let inserted = 0;
    let withCode = 0;
    for (const problem of parsed.data.problems) {
      const acceptedAt = problem.acceptedAt ? new Date(problem.acceptedAt) : new Date();
      const stored = await appendSubmissionEvent(tx, {
        userId,
        platform: "LEETCODE",
        problemSlug: problem.slug,
        problemTitle: problem.title,
        difficulty: problem.difficulty,
        acceptedAt,
        source: "IMPORT",
        verificationLevel: "IMPORTED",
        eventKey: submissionEventKey({
          userId,
          platform: "LEETCODE",
          problemSlug: problem.slug,
          acceptedAt,
          source: "IMPORT",
        }),
        code: problem.code,
        language: problem.language,
      });
      if (stored.isNew) inserted++;
      if (stored.codeSaved) withCode++;
    }
    return { inserted, withCode };
  });

  return NextResponse.json({ ok: true, received: parsed.data.problems.length, ...result });
}
