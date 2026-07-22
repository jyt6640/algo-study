import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// 초대코드로만 가입 (쉬운 참여 방지). 이미 멤버면 그대로 입장.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.toUpperCase().trim() : "";
  if (!inviteCode) {
    return NextResponse.json({ error: "초대코드가 필요합니다." }, { status: 400 });
  }

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.inviteCode, inviteCode))
    .limit(1);
  if (!group) return NextResponse.json({ error: "존재하지 않는 초대코드입니다." }, { status: 404 });

  const existing = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, group.id)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.memberships).values({ userId, groupId: group.id, role: "MEMBER" });
  }

  return NextResponse.json({ groupId: group.id }, { status: 200 });
}
