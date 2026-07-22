import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { generateInviteCode } from "@/lib/tokens";
import { currentUserId } from "@/lib/session";
import { groupCreateSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";
import { appendMembershipEvent, ensureTransaction } from "@/lib/ledger";
import { currentPeriod } from "@/lib/week";

export const runtime = "nodejs";

// 그룹 생성 + 로그인 사용자를 OWNER 멤버로 등록
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = groupCreateSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const body = parsed.data;
  const quota = body.quota;
  const periodDays = body.periodDays;
  const penaltyType = body.penaltyType;
  const penaltyAmount = body.penaltyAmount;
  const startDate = body.startDate ?? null;
  const endDate = body.endDate ?? null;

  const group = await ensureTransaction(async (tx) => {
    const [created] = await tx
      .insert(schema.groups)
      .values({
        name: body.name,
        inviteCode: generateInviteCode(),
        quota,
        periodDays,
        startDate: startDate ?? (periodDays !== 7 ? new Date().toISOString().slice(0, 10) : null),
        endDate,
        penaltyType,
        penaltyAmount,
        accountBank: body.accountBank ?? null,
        accountNumber: body.accountNumber ?? null,
        accountHolder: body.accountHolder ?? null,
      })
      .returning();
    const joinedAt = new Date();
    await tx.insert(schema.memberships).values({ userId, groupId: created.id, role: "OWNER", joinedAt });
    await appendMembershipEvent(tx, { groupId: created.id, userId, type: "JOINED", effectiveAt: joinedAt, actorUserId: userId });
    const period = currentPeriod(new Date(), created);
    if (!period.ended) {
      await tx.insert(schema.studyPeriods).values({
        groupId: created.id,
        periodOf: period.periodOf,
        startAt: period.start,
        endAt: period.end,
        quota: created.quota,
        penaltyType: created.penaltyType,
        penaltyAmount: created.penaltyAmount,
        timezone: created.timezone,
      });
    }
    return created;
  });

  return NextResponse.json({ group }, { status: 201 });
}
