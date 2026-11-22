import { importPayloadSchema } from "./ingestValidation";

export function findLeetCodeCode(problems: readonly unknown[], problemSlug: string) {
  for (const problem of problems) {
    const parsed = importPayloadSchema.shape.problems.element.safeParse(problem);
    if (parsed.success && parsed.data.slug === problemSlug && parsed.data.code?.trim()) {
      return parsed.data;
    }
  }
  return undefined;
}
