import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { issueExtensionToken } from "@/lib/tokens";

export const runtime = "nodejs";

// 확장 연동 토큰 발급. 원문(raw)은 이 응답에서 딱 한 번만 반환된다.
// body: { userId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "userId 가 필요합니다." }, { status: 400 });
  }

  const { raw, hash } = issueExtensionToken();
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hash });

  return NextResponse.json({ token: raw }, { status: 201 });
}
