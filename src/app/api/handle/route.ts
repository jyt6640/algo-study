import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchUserProfile } from "@/lib/leetcode";
import { currentUserId } from "@/lib/session";
import { handlePayloadSchema, readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// GET — 로그인 사용자의 현재 연동 핸들 (플랫폼별)
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ leetcode: null, programmers: null });
  const [u] = await db
    .select({ leetcode: schema.users.leetcodeHandle, programmers: schema.users.programmersHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return NextResponse.json({ leetcode: u?.leetcode ?? null, programmers: u?.programmers ?? null });
}

// POST { handle, platform } — 연동
//   LEETCODE: 실재 계정 검증 후 저장
//   PROGRAMMERS: 공개 API 가 없어 자기 선언값 그대로 저장
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = handlePayloadSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const { handle, platform } = parsed.data;

  if (platform === "PROGRAMMERS") {
    await db.update(schema.users).set({ programmersHandle: handle }).where(eq(schema.users.id, userId));
    return NextResponse.json({ ok: true, platform, handle });
  }

  const profile = await fetchUserProfile(handle).catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "존재하지 않는 LeetCode 계정입니다." }, { status: 404 });
  }
  await db.update(schema.users).set({ leetcodeHandle: profile.username }).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true, platform, profile });
}
