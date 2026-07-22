import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { ensureTransaction } from "@/lib/ledger";
import { resultPatchSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const membership = await getMembership(userId, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 변경할 수 있어요." }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = resultPatchSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const body = parsed.data;
  const resultId = body.resultId;
  const reason = body.reason || "방장 상태 변경";

  const actions: Array<"PAID" | "UNPAID" | "EXEMPTED" | "CORRECTED"> = [];
  if (typeof body.paid === "boolean") actions.push(body.paid ? "PAID" : "UNPAID");
  if (typeof body.exempt === "boolean") actions.push(body.exempt ? "EXEMPTED" : "CORRECTED");
  if (actions.length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const [legacy] = await db
    .select({ userId: schema.weeklyResults.userId, weekOf: schema.weeklyResults.weekOf })
    .from(schema.weeklyResults)
    .where(and(eq(schema.weeklyResults.id, resultId), eq(schema.weeklyResults.groupId, groupId)))
    .limit(1);
  if (!legacy) return NextResponse.json({ error: "결과를 찾을 수 없어요." }, { status: 404 });

  const periodResult = await db
    .select({ id: schema.periodResults.id })
    .from(schema.periodResults)
    .innerJoin(schema.studyPeriods, eq(schema.studyPeriods.id, schema.periodResults.periodId))
    .where(
      and(
        eq(schema.studyPeriods.groupId, groupId),
        eq(schema.studyPeriods.periodOf, legacy.weekOf),
        eq(schema.periodResults.userId, legacy.userId),
      ),
    )
    .limit(1);

  if (periodResult[0]) {
    await ensureTransaction(async (tx) => {
      for (const type of actions) {
        await tx.insert(schema.periodResultActions).values({
          periodResultId: periodResult[0].id,
          type,
          reason,
          actorUserId: userId,
          ...(type === "EXEMPTED" ? { penaltyAmount: 0 } : {}),
        });
        if (type === "PAID" || type === "UNPAID") {
          await tx
            .update(schema.weeklyResults)
            .set({ paid: type === "PAID", paidAt: type === "PAID" ? new Date() : null })
            .where(and(eq(schema.weeklyResults.id, resultId), eq(schema.weeklyResults.groupId, groupId)));
        }
        if (type === "EXEMPTED" || type === "CORRECTED") {
          await tx
            .update(schema.weeklyResults)
            .set({ exempt: type === "EXEMPTED" })
            .where(and(eq(schema.weeklyResults.id, resultId), eq(schema.weeklyResults.groupId, groupId)));
        }
      }
    });
    return NextResponse.json({ ok: true, versioned: true });
  }

  const legacyPatch: Record<string, unknown> = {};
  if (typeof body.paid === "boolean") {
    legacyPatch.paid = body.paid;
    legacyPatch.paidAt = body.paid ? new Date() : null;
  }
  if (typeof body.exempt === "boolean") legacyPatch.exempt = body.exempt;
  const [updated] = await db
    .update(schema.weeklyResults)
    .set(legacyPatch)
    .where(and(eq(schema.weeklyResults.id, resultId), eq(schema.weeklyResults.groupId, groupId)))
    .returning();
  return NextResponse.json({ ok: true, legacy: true, result: updated });
}
