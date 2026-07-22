import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { currentUserIsAdmin } from "@/lib/admin";
import { groupPatchSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";
import { ensureTransaction } from "@/lib/ledger";
import { currentPeriod } from "@/lib/week";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: "잘못된 그룹" }, { status: 400 });

  const [membership] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)))
    .limit(1);
  const admin = await currentUserIsAdmin();
  if (membership?.role !== "OWNER" && !admin) {
    return NextResponse.json({ error: "방장 또는 관리자만 삭제할 수 있어요." }, { status: 403 });
  }

  await db
    .update(schema.groups)
    .set({ active: false, archivedAt: new Date() })
    .where(eq(schema.groups.id, groupId));
  return NextResponse.json({ ok: true, archived: true });
}

// 방장만 그룹 설정 수정 (이름/목표/벌금/정산 계좌)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: "잘못된 그룹" }, { status: 400 });

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없어요." }, { status: 404 });

  const [membership] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)))
    .limit(1);
  if (membership?.role !== "OWNER" && !(await currentUserIsAdmin())) {
    return NextResponse.json({ error: "방장 또는 관리자만 바꿀 수 있어요." }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = groupPatchSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const patch: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const updated = await ensureTransaction(async (tx) => {
    const period = currentPeriod(new Date(), group);
    if (!period.ended) {
      await tx
        .insert(schema.studyPeriods)
        .values({
          groupId,
          periodOf: period.periodOf,
          startAt: period.start,
          endAt: period.end,
          quota: group.quota,
          penaltyType: group.penaltyType,
          penaltyAmount: group.penaltyAmount,
          timezone: group.timezone,
        })
        .onConflictDoNothing({ target: [schema.studyPeriods.groupId, schema.studyPeriods.periodOf] });
    }
    const [next] = await tx.update(schema.groups).set(patch).where(eq(schema.groups.id, groupId)).returning();
    return next;
  });

  return NextResponse.json({ group: updated });
}
