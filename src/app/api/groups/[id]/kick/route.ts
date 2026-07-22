import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { appendMembershipEvent, ensureTransaction } from "@/lib/ledger";
import { currentPeriod } from "@/lib/week";
import { kickSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// 방장이 멤버를 추방. body: { userId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUserId();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const membership = await getMembership(me, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 추방할 수 있어요." }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = kickSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: "userId 형식이 올바르지 않습니다." }, { status: 400 });
  const target = parsed.data.userId;
  if (target === me) return NextResponse.json({ error: "자신은 추방할 수 없어요." }, { status: 400 });

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없어요." }, { status: 404 });
  const [targetMembership] = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, target), eq(schema.memberships.groupId, groupId)))
    .limit(1);
  if (!targetMembership) return NextResponse.json({ error: "해당 사용자는 멤버가 아니에요." }, { status: 404 });
  await ensureTransaction(async (tx) => {
    await appendMembershipEvent(tx, {
      groupId,
      userId: target,
      type: "KICKED",
      effectiveAt: currentPeriod(new Date(), group).end,
      actorUserId: me,
    });
    await tx
      .delete(schema.memberships)
      .where(and(eq(schema.memberships.userId, target), eq(schema.memberships.groupId, groupId)));
  });
  return NextResponse.json({ ok: true });
}
