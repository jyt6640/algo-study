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

  const quota = Math.max(1, Number(body.quota ?? 7));
  const periodDays = Math.max(1, Number(body.periodDays ?? 7));
  const penaltyType: "FIXED" | "PER_MISSING" = body.penaltyType === "PER_MISSING" ? "PER_MISSING" : "FIXED";
  const penaltyAmount = Math.max(0, Number(body.penaltyAmount ?? 10000));
  const dateOnly = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const startDate = dateOnly(body.startDate);
  const endDate = dateOnly(body.endDate);

  const [group] = await db
    .insert(schema.groups)
    .values({
      name: body.name,
      inviteCode: generateInviteCode(),
      quota,
      periodDays,
      // 주기가 7일이 아니거나 시작일을 지정하면 startDate 로 기준을 잡는다 (7일 기본은 legacy 주단위 유지)
      startDate: startDate ?? (periodDays !== 7 ? new Date().toISOString().slice(0, 10) : null),
      endDate,
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
