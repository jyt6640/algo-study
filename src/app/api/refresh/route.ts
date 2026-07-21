import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { refreshLeetcode } from "@/lib/refresh";

export const runtime = "nodejs";

// 로그인 사용자의 LeetCode 최근 Accepted 를 즉시 폴링해 solveLogs 에 반영 (강제).
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const [user] = await db
    .select({ handle: schema.users.leetcodeHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user?.handle) {
    return NextResponse.json({ error: "LeetCode가 연동되어 있지 않아요." }, { status: 400 });
  }

  try {
    const inserted = await refreshLeetcode(userId, user.handle);
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "LeetCode 조회 실패" }, { status: 502 });
  }
}
