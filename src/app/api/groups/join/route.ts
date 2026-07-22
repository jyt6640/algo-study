import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { appendMembershipEvent, ensureTransaction } from "@/lib/ledger";
import { currentPeriod } from "@/lib/week";
import { inviteSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// 초대코드로만 가입 (쉬운 참여 방지). 이미 멤버면 그대로 입장.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = inviteSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: "초대코드 형식이 올바르지 않습니다." }, { status: 400 });
  const inviteCode = parsed.data.inviteCode;

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.inviteCode, inviteCode))
    .limit(1);
  if (!group) return NextResponse.json({ error: "존재하지 않는 초대코드입니다." }, { status: 404 });
  if (!group.active) return NextResponse.json({ error: "보관된 그룹에는 가입할 수 없습니다." }, { status: 410 });

  const existing = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, group.id)))
    .limit(1);
  if (existing.length === 0) {
    await ensureTransaction(async (tx) => {
      await tx.insert(schema.memberships).values({ userId, groupId: group.id, role: "MEMBER" });
      const period = currentPeriod(new Date(), group);
      await appendMembershipEvent(tx, {
        groupId: group.id,
        userId,
        type: "JOINED",
        effectiveAt: period.notStarted ? period.start : period.end,
        actorUserId: userId,
      });
    });
  }

  return NextResponse.json({ groupId: group.id }, { status: 200 });
}
