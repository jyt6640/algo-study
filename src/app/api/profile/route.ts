import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { currentUserIsAdmin } from "@/lib/admin";
import { nicknameSchema, readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

// GET — 로그인 사용자의 현재 닉네임
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ nickname: null });
  const [u] = await db
    .select({ nickname: schema.users.nickname })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return NextResponse.json({ nickname: u?.nickname ?? null });
}

// PATCH { nickname, userId? } — 닉네임 변경
//   본인: 자기 닉네임 변경
//   관리자: userId 를 지정해 다른 사용자 닉네임 변경
export async function PATCH(req: NextRequest) {
  const me = await currentUserId();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = nicknameSchema.safeParse(bodyResult.value);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  const { nickname } = parsed.data;
  const targetId = parsed.data.userId ?? me;

  if (targetId !== me && !(await currentUserIsAdmin())) {
    return NextResponse.json({ error: "다른 사용자는 관리자만 변경할 수 있어요." }, { status: 403 });
  }

  const updated = await db
    .update(schema.users)
    .set({ nickname })
    .where(eq(schema.users.id, targetId))
    .returning({ id: schema.users.id, nickname: schema.users.nickname });
  if (updated.length === 0) return NextResponse.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });

  return NextResponse.json({ ok: true, userId: targetId, nickname: updated[0].nickname });
}
