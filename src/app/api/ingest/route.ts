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

  // slug 기준 dedup: 이미 있으면 재사용, 없으면 삽입
  const [solve] = await db
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
    .returning();

  // 코드가 오면 Submission 에 저장 (신규 solve 인 경우에만 연결)
  if (solve && body.code) {
    await db.insert(schema.submissions).values({
      solveLogId: solve.id,
      language: body.language ?? null,
      code: String(body.code),
      submittedAt: acceptedAt,
    });
  }

  await db
    .update(schema.extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.extensionTokens.id, tok.id));

  return NextResponse.json({ ok: true, deduped: !solve }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
