import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";
import { bulkPayloadSchema, readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// 확장이 "내가 푼 문제 목록"을 일괄 업로드 (코드 없이 문제만). 프로그래머스 전체 반영용.
// Authorization: Bearer <연동토큰>
// body: { platform, problems: [{ slug, title }] }
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!raw) return NextResponse.json({ error: "연동 토큰이 없습니다." }, { status: 401 });

  const [tok] = await db
    .select({ id: schema.extensionTokens.id, userId: schema.extensionTokens.userId })
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.tokenHash, hashToken(raw)), isNull(schema.extensionTokens.revokedAt)))
    .limit(1);
  if (!tok) return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = bulkPayloadSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  const result = await ensureTransaction(async (tx) => {
    let inserted = 0;
    let withCode = 0;
    for (const p of parsed.data.problems) {
      const at = p.acceptedAt ? new Date(p.acceptedAt) : new Date();
      const stored = await appendSubmissionEvent(tx, {
        userId: tok.userId,
        platform: parsed.data.platform,
        problemSlug: p.slug,
        problemTitle: p.title,
        difficulty: p.difficulty,
        acceptedAt: at,
        source: "IMPORT",
        verificationLevel: "IMPORTED",
        eventKey: submissionEventKey({
          userId: tok.userId,
          platform: parsed.data.platform,
          problemSlug: p.slug,
          acceptedAt: at,
          source: "IMPORT",
        }),
        code: p.code,
        language: p.language,
      });
      if (stored.isNew) inserted++;
      if (stored.codeSaved) withCode++;
    }
    await tx.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, tok.id));
    return { inserted, withCode };
  });

  return NextResponse.json({ ok: true, received: parsed.data.problems.length, ...result });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
