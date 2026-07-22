import { z } from "zod";

const MAX_CODE_LENGTH = 200_000;

const manualSubmissionSchema = z.object({
  code: z
    .string()
    .max(MAX_CODE_LENGTH, "코드는 200KB 이하로 저장할 수 있어요.")
    .refine((value) => value.trim().length > 0, "코드를 입력하세요."),
  language: z.string().trim().max(80, "언어 이름은 80자 이하로 입력하세요.").optional(),
});

export type ManualSubmission = {
  readonly code: string;
  readonly language: string | null;
};

export class ManualSubmissionValidationError extends Error {
  readonly name = "ManualSubmissionValidationError";
}

export function parseManualSubmission(input: unknown): ManualSubmission {
  const parsed = manualSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ManualSubmissionValidationError(parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다.");
  }
  return { code: parsed.data.code, language: parsed.data.language || null };
}
