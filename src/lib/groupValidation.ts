import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = dateOnly.nullable().optional();

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quota: z.number().int().min(1).max(365).default(7),
  periodDays: z.number().int().min(1).max(365).default(7),
  penaltyType: z.enum(["FIXED", "PER_MISSING"]).default("FIXED"),
  penaltyAmount: z.number().int().min(0).max(10_000_000).default(10_000),
  startDate: optionalDate,
  endDate: optionalDate,
  accountBank: z.string().trim().max(80).nullable().optional(),
  accountNumber: z.string().trim().max(120).nullable().optional(),
  accountHolder: z.string().trim().max(120).nullable().optional(),
});

export const groupPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
  quota: z.number().int().min(1).max(365).optional(),
  periodDays: z.number().int().min(1).max(365).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  penaltyType: z.enum(["FIXED", "PER_MISSING"]).optional(),
  penaltyAmount: z.number().int().min(0).max(10_000_000).optional(),
  accountBank: z.string().trim().max(80).nullable().optional(),
  accountNumber: z.string().trim().max(120).nullable().optional(),
  accountHolder: z.string().trim().max(120).nullable().optional(),
  discordWebhook: z.string().url().max(500).nullable().optional(),
});

export const inviteSchema = z.object({ inviteCode: z.string().trim().toUpperCase().min(4).max(32).regex(/^[A-Z0-9_-]+$/) });
export const kickSchema = z.object({ userId: z.number().int().positive() });
export const resultPatchSchema = z.object({
  resultId: z.number().int().positive(),
  paid: z.boolean().optional(),
  exempt: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});
export const githubLinkSchema = z.object({
  mode: z.literal("existing").default("existing"),
  repo: z.string().trim().min(3).max(200),
  installationId: z.string().trim().regex(/^\d+$/).max(40).optional().default(""),
});
