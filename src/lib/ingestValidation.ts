import { z } from "zod";

export const MAX_BODY_BYTES = 1_048_576;
export const MAX_BULK_ITEMS = 100;
export const MAX_CODE_LENGTH = 200_000;

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "acceptedAt이 올바른 날짜가 아닙니다.");
const platform = z.enum(["LEETCODE", "PROGRAMMERS"]).default("LEETCODE");
const problem = z.object({
  slug: z.string().trim().min(1).max(300),
  title: z.string().trim().max(240).optional(),
  difficulty: z.string().trim().max(80).optional(),
  acceptedAt: isoDate.optional(),
  code: z.string().max(MAX_CODE_LENGTH).optional(),
  language: z.string().trim().max(80).optional(),
});

export const ingestPayloadSchema = z.object({
  platform,
  problemSlug: z.string().trim().min(1).max(300),
  problemTitle: z.string().trim().max(240).optional(),
  difficulty: z.string().trim().max(80).optional(),
  acceptedAt: isoDate.optional(),
  language: z.string().trim().max(80).optional(),
  code: z.string().max(MAX_CODE_LENGTH).optional(),
});

export const bulkPayloadSchema = z.object({
  platform,
  problems: z.array(problem).min(1).max(MAX_BULK_ITEMS),
});

export const importPayloadSchema = z.object({
  problems: z.array(problem).min(1).max(MAX_BULK_ITEMS),
});

export const linkPayloadSchema = z.object({
  handle: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
});
export const handlePayloadSchema = linkPayloadSchema.extend({ platform: z.enum(["LEETCODE", "PROGRAMMERS"]).default("LEETCODE") });
export const tokenDeleteSchema = z.object({ id: z.number().int().positive() });

export const nicknameSchema = z.object({
  nickname: z.string().trim().min(1, "닉네임을 입력하세요.").max(30, "닉네임은 30자 이하로 해주세요."),
  // 관리자가 다른 사용자를 변경할 때만 사용
  userId: z.number().int().positive().optional(),
});

export async function readJsonBody(req: Request): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly status: 400 | 413; readonly error: string }> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "요청 본문이 너무 큽니다." };
  }
  let text: string;
  try {
    text = await req.text();
  } catch (error) {
    if (error instanceof Error) return { ok: false, status: 400, error: "입력 형식이 올바르지 않습니다." };
    throw error;
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "요청 본문이 너무 큽니다." };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, status: 400, error: "입력 형식이 올바르지 않습니다." };
    throw error;
  }
}
