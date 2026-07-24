import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";
import { manualSolveSchema, readJsonBody } from "@/lib/ingestValidation";
import { bookSlug } from "@/lib/platform";

export const runtime = "nodejs";

// 책 등 온라인 저지가 아닌 문제를 직접 기입 (제목·문제 내용·코드).
// 스터디 멤버 본인만 자기 풀이를 추가할 수 있다.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (!(await getMembership(userId, groupId)))
    return NextResponse.json({ error: "멤버만 추가할 수 있어요." }, { status: 403 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = manualSolveSchema.safeParse(bodyResult.value);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  const { title, description, code, language, difficulty } = parsed.data;
  const acceptedAt = parsed.data.acceptedAt ? new Date(parsed.data.acceptedAt) : new Date();
  const slug = bookSlug(title);

  const stored = await ensureTransaction((tx) =>
    appendSubmissionEvent(tx, {
      userId,
      platform: "BOOK",
      problemSlug: slug,
      problemTitle: title,
      description: description || null,
      difficulty: difficulty || null,
      acceptedAt,
      source: "MANUAL",
      verificationLevel: "MANUAL_PENDING",
      eventKey: submissionEventKey({
        userId,
        platform: "BOOK",
        problemSlug: slug,
        acceptedAt,
        source: "MANUAL",
      }),
      code: code || undefined,
      language: language || undefined,
    }),
  );

  // 같은 제목으로 이미 있으면 제목·내용·난이도를 최신 입력으로 갱신한다.
  if (stored.solveId) {
    await db
      .update(schema.solveLogs)
      .set({
        problemTitle: title,
        description: description || null,
        difficulty: difficulty || null,
      })
      .where(eq(schema.solveLogs.id, stored.solveId));
  }

  return NextResponse.json({ ok: true, solveId: stored.solveId, isNew: stored.isNew });
}
