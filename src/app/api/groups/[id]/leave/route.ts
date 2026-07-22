import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { appendMembershipEvent, ensureTransaction } from "@/lib/ledger";
import { currentPeriod } from "@/lib/week";

export const runtime = "nodejs";

// 멤버가 그룹에서 나가기. 방장은 나갈 수 없음(삭제하거나 위임 필요).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);

  const [membership] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: "멤버가 아니에요." }, { status: 400 });
  if (membership.role === "OWNER") {
    return NextResponse.json({ error: "방장은 나갈 수 없어요. 설정에서 스터디를 삭제하세요." }, { status: 400 });
  }

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없어요." }, { status: 404 });
  await ensureTransaction(async (tx) => {
    await appendMembershipEvent(tx, {
      groupId,
      userId,
      type: "LEFT",
      effectiveAt: currentPeriod(new Date(), group).end,
      actorUserId: userId,
    });
    await tx
      .delete(schema.memberships)
      .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)));
  });
  return NextResponse.json({ ok: true });
}
