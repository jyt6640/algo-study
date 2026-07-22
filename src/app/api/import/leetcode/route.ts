import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

// 웹 세션 기반 LeetCode 코드 일괄 저장 (확장 bridge 가 LeetCode 세션으로 가져온 코드를 넘겨줌).
// body: { problems: [{ slug, title, acceptedAt, code, language }] }
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const problems: Array<{ slug: string; title?: string; acceptedAt?: string; code?: string; language?: string }> =
    Array.isArray(body?.problems) ? body.problems : [];
  if (problems.length === 0) return NextResponse.json({ error: "problems 가 필요합니다." }, { status: 400 });
  if (problems.length > 3000) return NextResponse.json({ error: "너무 많아요." }, { status: 400 });

  const now = new Date();
  let inserted = 0;
  let withCode = 0;
  for (const p of problems) {
    const slug = typeof p?.slug === "string" ? p.slug.trim() : "";
    if (!slug) continue;
    const acceptedAt = p.acceptedAt ? new Date(p.acceptedAt) : now;
    const at = Number.isNaN(acceptedAt.getTime()) ? now : acceptedAt;

    const ins = await db
      .insert(schema.solveLogs)
      .values({
        userId,
        platform: "LEETCODE",
        problemSlug: slug,
        problemTitle: p.title ?? null,
        acceptedAt: at,
        source: "EXTENSION",
      })
      .onConflictDoNothing({
        target: [schema.solveLogs.userId, schema.solveLogs.platform, schema.solveLogs.problemSlug],
      })
      .returning({ id: schema.solveLogs.id });
    let solveId = ins[0]?.id;
    if (ins.length) inserted++;
    else {
      const [ex] = await db
        .select({ id: schema.solveLogs.id })
        .from(schema.solveLogs)
        .where(
          and(
            eq(schema.solveLogs.userId, userId),
            eq(schema.solveLogs.platform, "LEETCODE"),
            eq(schema.solveLogs.problemSlug, slug),
          ),
        )
        .limit(1);
      solveId = ex?.id;
    }

    const code = typeof p.code === "string" ? p.code.slice(0, 200_000) : "";
    if (solveId && code) {
      await db
        .insert(schema.submissions)
        .values({ solveLogId: solveId, language: p.language ?? null, code, submittedAt: at })
        .onConflictDoUpdate({
          target: schema.submissions.solveLogId,
          set: { language: p.language ?? null, code, submittedAt: at },
        });
      withCode++;
    }
  }

  return NextResponse.json({ ok: true, received: problems.length, inserted, withCode });
}
