import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { issueExtensionToken } from "@/lib/tokens";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

// 로그인 사용자용 확장 연동 토큰 발급. 원문(raw)은 이 응답에서 한 번만 반환.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { raw, hash } = issueExtensionToken();
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hash });

  return NextResponse.json({ token: raw }, { status: 201 });
}
