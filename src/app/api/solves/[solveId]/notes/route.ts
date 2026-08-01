import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";

const MAX_NOTE = 10_000;

const noteSchema = z.object({
  // 풀이 전체 메모. line 이 있으면 그 줄의 메모.
  line: z.number().int().positive().max(100_000).optional(),
  body: z.string().max(MAX_NOTE),
});

const deleteSchema = z.object({ line: z.number().int().positive().max(100_000) });

/** 내 메모 전부 (풀이 메모 + 라인 메모). 메모는 작성자 본인에게만 보인다. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ solveId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ note: null, lineNotes: [] });

  const { solveId } = await params;
  const sid = Number(solveId);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const [note] = await db
    .select({ body: schema.solveNotes.body })
    .from(schema.solveNotes)
    .where(and(eq(schema.solveNotes.solveLogId, sid), eq(schema.solveNotes.userId, userId)))
    .limit(1);

  const lineNotes = await db
    .select({ line: schema.solveLineNotes.line, body: schema.solveLineNotes.body })
    .from(schema.solveLineNotes)
    .where(and(eq(schema.solveLineNotes.solveLogId, sid), eq(schema.solveLineNotes.userId, userId)));

  return NextResponse.json({ note: note?.body ?? null, lineNotes });
}

/** 메모 저장 (본문이 비면 삭제) */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ solveId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { solveId } = await params;
  const sid = Number(solveId);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = noteSchema.safeParse(bodyResult.value);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });

  // 풀이가 실제로 있는지 확인
  const [solve] = await db
    .select({ id: schema.solveLogs.id })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.id, sid))
    .limit(1);
  if (!solve) return NextResponse.json({ error: "풀이를 찾을 수 없어요." }, { status: 404 });

  const body = parsed.data.body.trim();
  const line = parsed.data.line;
  const now = new Date();

  if (line === undefined) {
    if (!body) {
      await db
        .delete(schema.solveNotes)
        .where(and(eq(schema.solveNotes.solveLogId, sid), eq(schema.solveNotes.userId, userId)));
      return NextResponse.json({ ok: true, note: null });
    }
    await db
      .insert(schema.solveNotes)
      .values({ solveLogId: sid, userId, body })
      .onConflictDoUpdate({
        target: [schema.solveNotes.solveLogId, schema.solveNotes.userId],
        set: { body, updatedAt: now },
      });
    return NextResponse.json({ ok: true, note: body });
  }

  if (!body) {
    await db
      .delete(schema.solveLineNotes)
      .where(
        and(
          eq(schema.solveLineNotes.solveLogId, sid),
          eq(schema.solveLineNotes.userId, userId),
          eq(schema.solveLineNotes.line, line),
        ),
      );
    return NextResponse.json({ ok: true, line, body: null });
  }

  await db
    .insert(schema.solveLineNotes)
    .values({ solveLogId: sid, userId, line, body })
    .onConflictDoUpdate({
      target: [schema.solveLineNotes.solveLogId, schema.solveLineNotes.userId, schema.solveLineNotes.line],
      set: { body, updatedAt: now },
    });
  return NextResponse.json({ ok: true, line, body });
}

/** 라인 메모 삭제 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ solveId: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { solveId } = await params;
  const sid = Number(solveId);
  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = deleteSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: "line 이 필요합니다." }, { status: 400 });

  await db
    .delete(schema.solveLineNotes)
    .where(
      and(
        eq(schema.solveLineNotes.solveLogId, sid),
        eq(schema.solveLineNotes.userId, userId),
        eq(schema.solveLineNotes.line, parsed.data.line),
      ),
    );
  return NextResponse.json({ ok: true });
}
