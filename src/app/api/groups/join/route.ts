import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// 초대코드 또는 groupId(활성 스터디 둘러보기)로 가입. 이미 멤버면 그대로 입장.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const groupId = Number(body?.groupId);
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.toUpperCase().trim() : "";

  let group;
  if (Number.isFinite(groupId)) {
    [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    // 공개 참여는 활성 스터디만
    if (group && !group.active) {
      return NextResponse.json({ error: "비활성 스터디예요. 초대코드로만 참여할 수 있어요." }, { status: 400 });
    }
  } else if (inviteCode) {
    [group] = await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, inviteCode)).limit(1);
  } else {
    return NextResponse.json({ error: "inviteCode 또는 groupId 가 필요합니다." }, { status: 400 });
  }

  if (!group) return NextResponse.json({ error: "존재하지 않는 스터디입니다." }, { status: 404 });

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
