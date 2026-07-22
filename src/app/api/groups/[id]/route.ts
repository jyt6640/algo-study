import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// 방장만 그룹 삭제 (멤버십·주간결과는 cascade 로 함께 삭제)
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
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 삭제할 수 있어요." }, { status: 403 });
  }

  await db.delete(schema.groups).where(eq(schema.groups.id, groupId));
  return NextResponse.json({ ok: true });
}

// 방장만 그룹 설정 수정 (이름/목표/벌금/정산 계좌)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 설정을 바꿀 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.quota != null) patch.quota = Math.max(1, Number(body.quota));
  if (body.penaltyType === "FIXED" || body.penaltyType === "PER_MISSING") patch.penaltyType = body.penaltyType;
  if (body.penaltyAmount != null) patch.penaltyAmount = Math.max(0, Number(body.penaltyAmount));
  if ("accountBank" in body) patch.accountBank = body.accountBank || null;
  if ("accountNumber" in body) patch.accountNumber = body.accountNumber || null;
  if ("accountHolder" in body) patch.accountHolder = body.accountHolder || null;
  if ("discordWebhook" in body) patch.discordWebhook = body.discordWebhook || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.groups)
    .set(patch)
    .where(eq(schema.groups.id, groupId))
    .returning();

  return NextResponse.json({ group: updated });
}
