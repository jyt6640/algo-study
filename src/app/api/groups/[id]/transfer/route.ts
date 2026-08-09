import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { ensureTransaction } from "@/lib/ledger";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

const transferSchema = z.object({ userId: z.number().int().positive() });

// 방장 위임: 현재 방장이 다른 멤버에게 방장 권한을 넘긴다.
// 넘긴 사람은 일반 멤버가 되고, 그 뒤엔 스터디를 나갈 수 있다.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUserId();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const membership = await getMembership(me, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 위임할 수 있어요." }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = transferSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: "userId 형식이 올바르지 않습니다." }, { status: 400 });

  const target = parsed.data.userId;
  if (target === me) return NextResponse.json({ error: "이미 방장이에요." }, { status: 400 });

  const targetMembership = await getMembership(target, groupId);
  if (!targetMembership) return NextResponse.json({ error: "이 스터디의 멤버가 아니에요." }, { status: 404 });

  await ensureTransaction(async (tx) => {
    await tx
      .update(schema.memberships)
      .set({ role: "OWNER" })
      .where(and(eq(schema.memberships.userId, target), eq(schema.memberships.groupId, groupId)));
    await tx
      .update(schema.memberships)
      .set({ role: "MEMBER" })
      .where(and(eq(schema.memberships.userId, me), eq(schema.memberships.groupId, groupId)));
  });

  const [newOwner] = await db
    .select({ nickname: schema.users.nickname })
    .from(schema.users)
    .where(eq(schema.users.id, target))
    .limit(1);

  return NextResponse.json({ ok: true, newOwner: newOwner?.nickname ?? null });
}
