import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { generateInviteCode } from "@/lib/tokens";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// 그룹 생성 + 로그인 사용자를 OWNER 멤버로 등록
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "name 이 필요합니다." }, { status: 400 });
  }

  const quota = Number(body.quota ?? 7);
  const penaltyType: "FIXED" | "PER_MISSING" = body.penaltyType === "PER_MISSING" ? "PER_MISSING" : "FIXED";
  const penaltyAmount = Number(body.penaltyAmount ?? 10000);

  const [group] = await db
    .insert(schema.groups)
    .values({
      name: body.name,
      inviteCode: generateInviteCode(),
      quota,
      penaltyType,
      penaltyAmount,
      accountBank: body.accountBank ?? null,
      accountNumber: body.accountNumber ?? null,
      accountHolder: body.accountHolder ?? null,
    })
    .returning();

  await db.insert(schema.memberships).values({
    userId,
    groupId: group.id,
    role: "OWNER",
  });

  return NextResponse.json({ group }, { status: 201 });
}
