import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";

export const runtime = "nodejs";

// 문제 풀이에 "치팅 의심" 신고 (멤버만). 자기 자신은 신고 불가. 중복 신고는 무시.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (!(await getMembership(userId, groupId)))
    return NextResponse.json({ error: "멤버만 신고할 수 있어요." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const solveLogId = Number(body.solveLogId);
  const reason: string | null = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  if (!Number.isFinite(solveLogId)) return NextResponse.json({ error: "solveLogId 필요" }, { status: 400 });

  // 신고 대상 풀이가 이 그룹 멤버의 것인지 확인
  const [solve] = await db
    .select({ userId: schema.solveLogs.userId })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.id, solveLogId))
    .limit(1);
  if (!solve) return NextResponse.json({ error: "풀이를 찾을 수 없어요." }, { status: 404 });
  if (solve.userId === userId)
    return NextResponse.json({ error: "본인 풀이는 신고할 수 없어요." }, { status: 400 });

  await db
    .insert(schema.cheatReports)
    .values({ groupId, solveLogId, reporterId: userId, reason })
    .onConflictDoNothing({ target: [schema.cheatReports.solveLogId, schema.cheatReports.reporterId] });

  return NextResponse.json({ ok: true, reported: true });
}

// 신고 취소
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json().catch(() => ({}));
  const solveLogId = Number(body.solveLogId);
  if (!Number.isFinite(solveLogId)) return NextResponse.json({ error: "solveLogId 필요" }, { status: 400 });

  await db
    .delete(schema.cheatReports)
    .where(
      and(
        eq(schema.cheatReports.groupId, groupId),
        eq(schema.cheatReports.solveLogId, solveLogId),
        eq(schema.cheatReports.reporterId, userId),
      ),
    );
  return NextResponse.json({ ok: true, reported: false });
}
