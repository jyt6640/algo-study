import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchUserProfile } from "@/lib/leetcode";

export const runtime = "nodejs";

// GET /api/handle?userId=1 — 현재 연동된 핸들 조회
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("userId"));
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "userId 필요" }, { status: 400 });
  const [u] = await db
    .select({ handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return NextResponse.json({ handle: u?.handle ?? null });
}

// POST /api/handle { userId, handle } — 핸들 검증 후 연동
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  if (!Number.isFinite(userId) || !handle) {
    return NextResponse.json({ error: "userId, handle 이 필요합니다." }, { status: 400 });
  }

  // 실재 계정인지 확인 후 저장
  const profile = await fetchUserProfile(handle).catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "존재하지 않는 LeetCode 계정입니다." }, { status: 404 });
  }

  await db
    .update(schema.users)
    .set({ leetcodeHandle: profile.username })
    .where(eq(schema.users.id, userId));

  return NextResponse.json({ ok: true, profile });
}
