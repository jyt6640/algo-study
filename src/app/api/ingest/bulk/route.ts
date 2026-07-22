import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";

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

  const body = await req.json().catch(() => null);
  const platform: "LEETCODE" | "PROGRAMMERS" = body?.platform === "PROGRAMMERS" ? "PROGRAMMERS" : "LEETCODE";
  const problems: Array<{ slug: string; title?: string; acceptedAt?: string; difficulty?: string }> = Array.isArray(
    body?.problems,
  )
    ? body.problems
    : [];
  if (problems.length === 0) {
    return NextResponse.json({ error: "problems 배열이 필요합니다." }, { status: 400 });
  }
  if (problems.length > 3000) {
    return NextResponse.json({ error: "한 번에 3000개까지만 가능합니다." }, { status: 400 });
  }

  const now = new Date();
  let inserted = 0;
  for (const p of problems) {
    const slug = typeof p?.slug === "string" ? p.slug.trim() : "";
    if (!slug) continue;
    const acceptedAt = p.acceptedAt ? new Date(p.acceptedAt) : now;
    const res = await db
      .insert(schema.solveLogs)
      .values({
        userId: tok.userId,
        platform,
        problemSlug: slug,
        problemTitle: p.title ?? null,
        difficulty: p.difficulty ?? null,
        acceptedAt: Number.isNaN(acceptedAt.getTime()) ? now : acceptedAt,
        source: "EXTENSION",
      })
      .onConflictDoNothing({
        target: [schema.solveLogs.userId, schema.solveLogs.platform, schema.solveLogs.problemSlug],
      })
      .returning({ id: schema.solveLogs.id });
    if (res.length) inserted++;
  }

  await db.update(schema.extensionTokens).set({ lastUsedAt: now }).where(eq(schema.extensionTokens.id, tok.id));
  return NextResponse.json({ ok: true, received: problems.length, inserted });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
