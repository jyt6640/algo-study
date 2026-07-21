import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

// 확장프로그램(경로 ②)이 Accepted 제출을 push 하는 엔드포인트
// Authorization: Bearer <연동토큰>
// body: { problemSlug, problemTitle?, difficulty?, acceptedAt(ISO)?, language?, code? }
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!raw) {
    return NextResponse.json({ error: "연동 토큰이 없습니다." }, { status: 401 });
  }

  const [tok] = await db
    .select()
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.tokenHash, hashToken(raw)), isNull(schema.extensionTokens.revokedAt)))
    .limit(1);

  if (!tok) {
    return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.problemSlug) {
    return NextResponse.json({ error: "problemSlug 가 필요합니다." }, { status: 400 });
  }

  const acceptedAt = body.acceptedAt ? new Date(body.acceptedAt) : new Date();

  // solveLog upsert: 신규면 삽입, 이미 있으면 기존 행을 재사용 (항상 id 확보)
  const inserted = await db
    .insert(schema.solveLogs)
    .values({
      userId: tok.userId,
      problemSlug: body.problemSlug,
      problemTitle: body.problemTitle ?? null,
      difficulty: body.difficulty ?? null,
      acceptedAt,
      source: "EXTENSION",
    })
    .onConflictDoNothing({ target: [schema.solveLogs.userId, schema.solveLogs.problemSlug] })
    .returning({ id: schema.solveLogs.id });

  let solveId = inserted[0]?.id;
  const isNew = inserted.length > 0;
  if (!solveId) {
    const [existing] = await db
      .select({ id: schema.solveLogs.id })
      .from(schema.solveLogs)
      .where(and(eq(schema.solveLogs.userId, tok.userId), eq(schema.solveLogs.problemSlug, body.problemSlug)))
      .limit(1);
    solveId = existing?.id;
  }

  // 코드가 오면 저장/갱신 (재업로드 시 최신 코드로 업데이트) — solveLog 당 1개
  let codeSaved = false;
  if (solveId && body.code) {
    await db
      .insert(schema.submissions)
      .values({
        solveLogId: solveId,
        language: body.language ?? null,
        code: String(body.code),
        submittedAt: acceptedAt,
      })
      .onConflictDoUpdate({
        target: schema.submissions.solveLogId,
        set: { language: body.language ?? null, code: String(body.code), submittedAt: acceptedAt },
      });
    codeSaved = true;
  }

  await db
    .update(schema.extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.extensionTokens.id, tok.id));

  return NextResponse.json({ ok: true, isNew, codeSaved }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
