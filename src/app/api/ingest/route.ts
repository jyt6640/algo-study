import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";
import { ingestPayloadSchema, readJsonBody } from "@/lib/ingestValidation";

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

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = ingestPayloadSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  const body = parsed.data;
  const acceptedAt = body.acceptedAt ? new Date(body.acceptedAt) : new Date();
  const result = await ensureTransaction(async (tx) => {
    const stored = await appendSubmissionEvent(tx, {
      userId: tok.userId,
      platform: body.platform,
      problemSlug: body.problemSlug,
      problemTitle: body.problemTitle,
      difficulty: body.difficulty,
      acceptedAt,
      source: "EXTENSION",
      verificationLevel: "EXTENSION_VERIFIED",
      eventKey: submissionEventKey({
        userId: tok.userId,
        platform: body.platform,
        problemSlug: body.problemSlug,
        acceptedAt,
        source: "EXTENSION",
      }),
      code: body.code,
      language: body.language,
    });
    await tx.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, tok.id));
    return stored;
  });

  return NextResponse.json({ ok: true, isNew: result.isNew, codeSaved: result.codeSaved }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
