import { NextRequest, NextResponse } from "next/server";
import { fetchUserProfile } from "@/lib/leetcode";

export const runtime = "nodejs";

// GET /api/leetcode/verify?handle=xxx — 실재 계정인지 확인 + 프로필 요약
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle")?.trim();
  if (!handle) return NextResponse.json({ error: "handle 이 필요합니다." }, { status: 400 });

  try {
    const profile = await fetchUserProfile(handle);
    if (!profile) return NextResponse.json({ exists: false });
    return NextResponse.json({ exists: true, profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 502 },
    );
  }
}
