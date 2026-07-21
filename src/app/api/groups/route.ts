import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { generateInviteCode } from "@/lib/tokens";

export const runtime = "nodejs";

// 그룹 생성 + 생성자를 OWNER 멤버로 등록
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.ownerNickname) {
    return NextResponse.json({ error: "name, ownerNickname 이 필요합니다." }, { status: 400 });
  }

  const timezone = body.timezone ?? "Asia/Seoul";
  const quota = Number(body.quota ?? 7);
  const penaltyType: "FIXED" | "PER_MISSING" = body.penaltyType === "PER_MISSING" ? "PER_MISSING" : "FIXED";
  const penaltyAmount = Number(body.penaltyAmount ?? 10000);

  const [owner] = await db
    .insert(schema.users)
    .values({
      nickname: body.ownerNickname,
      leetcodeHandle: body.leetcodeHandle ?? null,
      timezone,
    })
    .returning();

  const [group] = await db
    .insert(schema.groups)
    .values({
      name: body.name,
      inviteCode: generateInviteCode(),
      quota,
      penaltyType,
      penaltyAmount,
      timezone,
    })
    .returning();

  await db.insert(schema.memberships).values({
    userId: owner.id,
    groupId: group.id,
    role: "OWNER",
  });

  return NextResponse.json({ group, userId: owner.id }, { status: 201 });
}
