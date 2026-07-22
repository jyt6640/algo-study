import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";

export const runtime = "nodejs";

// 방장이 주간 결과의 납부/면제 상태를 변경.
// PATCH body: { resultId, paid?, exempt? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const membership = await getMembership(userId, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 변경할 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const resultId = Number(body?.resultId);
  if (!Number.isFinite(resultId)) return NextResponse.json({ error: "resultId 필요" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.paid === "boolean") {
    patch.paid = body.paid;
    patch.paidAt = body.paid ? new Date() : null;
  }
  if (typeof body.exempt === "boolean") patch.exempt = body.exempt;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.weeklyResults)
    .set(patch)
    .where(and(eq(schema.weeklyResults.id, resultId), eq(schema.weeklyResults.groupId, groupId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "결과를 찾을 수 없어요." }, { status: 404 });
  return NextResponse.json({ ok: true, result: updated });
}
