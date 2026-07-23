import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";

export const runtime = "nodejs";

// 풀이(solveLog) 취소/삭제.
// - 본인: 자기 풀이를 취소할 수 있음
// - 방장: 이 그룹 멤버의 풀이를 (치팅 검토 후) 삭제할 수 있음
// 삭제 시 연결된 코드(submissions)·신고(cheat_reports)도 FK cascade 로 함께 제거됨.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; solveId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id, solveId } = await params;
  const groupId = Number(id);
  const sid = Number(solveId);
  if (!Number.isFinite(groupId) || !Number.isFinite(sid))
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const membership = await getMembership(userId, groupId);
  if (!membership) return NextResponse.json({ error: "멤버가 아니에요." }, { status: 403 });

  const [solve] = await db
    .select({
      userId: schema.solveLogs.userId,
      platform: schema.solveLogs.platform,
      slug: schema.solveLogs.problemSlug,
    })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.id, sid))
    .limit(1);
  if (!solve) return NextResponse.json({ error: "풀이를 찾을 수 없어요." }, { status: 404 });

  const isSelf = solve.userId === userId;
  const isOwner = membership.role === "OWNER";
  if (!isSelf && !isOwner)
    return NextResponse.json({ error: "본인 풀이거나 방장만 삭제할 수 있어요." }, { status: 403 });

  // 방장이 남의 풀이를 삭제할 땐, 그 사람이 이 그룹 멤버인지 확인
  if (!isSelf) {
    const targetMembership = await getMembership(solve.userId, groupId);
    if (!targetMembership)
      return NextResponse.json({ error: "이 그룹 멤버의 풀이가 아니에요." }, { status: 400 });
  }

  await db.delete(schema.solveLogs).where(eq(schema.solveLogs.id, sid));

  // 자동 재수집(cron 폴링 / 대량 import)으로 되살아나지 않게 제외 목록에 기록.
  // 나중에 사용자가 직접(수동 입력/실시간 재풀이) 등록하면 자동 해제된다.
  await db
    .insert(schema.excludedSolves)
    .values({
      userId: solve.userId,
      platform: solve.platform,
      problemSlug: solve.slug,
      reason: isSelf ? "본인 취소" : "방장 취소",
      excludedBy: userId,
    })
    .onConflictDoNothing({
      target: [schema.excludedSolves.userId, schema.excludedSolves.platform, schema.excludedSolves.problemSlug],
    });

  return NextResponse.json({ ok: true, deletedBy: isSelf ? "self" : "owner" });
}
