import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchUserProfile } from "@/lib/leetcode";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// GET — 로그인 사용자의 현재 연동 핸들
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ handle: null });
  const [u] = await db
    .select({ handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return NextResponse.json({ handle: u?.handle ?? null });
}

// POST { handle } — 실재 계정 검증 후 로그인 사용자에 연동
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  if (!handle) return NextResponse.json({ error: "handle 이 필요합니다." }, { status: 400 });

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
