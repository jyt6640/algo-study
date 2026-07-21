import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

// 확장이 LeetCode 로그인 세션에서 감지한 username 을 계정에 연결한다.
// Authorization: Bearer <연동토큰>, body: { handle }
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!raw) return NextResponse.json({ error: "연동 토큰이 없습니다." }, { status: 401 });

  const [tok] = await db
    .select()
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.tokenHash, hashToken(raw)), isNull(schema.extensionTokens.revokedAt)))
    .limit(1);
  if (!tok) return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  if (!handle) return NextResponse.json({ error: "handle 이 필요합니다." }, { status: 400 });

  await db.update(schema.users).set({ leetcodeHandle: handle }).where(eq(schema.users.id, tok.userId));

  return NextResponse.json({ ok: true, handle }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
