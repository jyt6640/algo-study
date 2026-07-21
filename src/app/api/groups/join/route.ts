import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const runtime = "nodejs";

// 초대코드로 그룹 가입 (유저 생성 + MEMBER 등록)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.inviteCode || !body?.nickname) {
    return NextResponse.json({ error: "inviteCode, nickname 이 필요합니다." }, { status: 400 });
  }

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.inviteCode, String(body.inviteCode).toUpperCase()))
    .limit(1);

  if (!group) {
    return NextResponse.json({ error: "존재하지 않는 초대코드입니다." }, { status: 404 });
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      nickname: body.nickname,
      leetcodeHandle: body.leetcodeHandle ?? null,
      timezone: group.timezone,
    })
    .returning();

  await db.insert(schema.memberships).values({
    userId: user.id,
    groupId: group.id,
    role: "MEMBER",
  });

  return NextResponse.json({ groupId: group.id, userId: user.id }, { status: 201 });
}
