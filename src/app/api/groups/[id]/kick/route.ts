import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";

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

  const body = await req.json().catch(() => ({}));
  const target = Number(body?.userId);
  if (!Number.isFinite(target)) return NextResponse.json({ error: "userId 필요" }, { status: 400 });
  if (target === me) return NextResponse.json({ error: "자신은 추방할 수 없어요." }, { status: 400 });

  await db
    .delete(schema.memberships)
    .where(and(eq(schema.memberships.userId, target), eq(schema.memberships.groupId, groupId)));
  return NextResponse.json({ ok: true });
}
