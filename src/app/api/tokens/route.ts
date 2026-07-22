import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { issueExtensionToken } from "@/lib/tokens";
import { currentUserId } from "@/lib/session";
import { readJsonBody, tokenDeleteSchema } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// 로그인 사용자의 활성 확장 토큰 목록 (원문은 안 보이고 메타데이터만)
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ tokens: [] });
  const tokens = await db
    .select({
      id: schema.extensionTokens.id,
      createdAt: schema.extensionTokens.createdAt,
      lastUsedAt: schema.extensionTokens.lastUsedAt,
    })
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.userId, userId), isNull(schema.extensionTokens.revokedAt)))
    .orderBy(desc(schema.extensionTokens.createdAt));
  return NextResponse.json({ tokens });
}

// 확장 연동 토큰 발급. 원문(raw)은 이 응답에서 한 번만 반환.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { raw, hash } = issueExtensionToken();
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hash });
  return NextResponse.json({ token: raw }, { status: 201 });
}

// 토큰 폐기. body: { id }
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = tokenDeleteSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const id = parsed.data.id;

  await db
    .update(schema.extensionTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.extensionTokens.id, id), eq(schema.extensionTokens.userId, userId)));
  return NextResponse.json({ ok: true });
}
