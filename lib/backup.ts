import { z } from "zod";
import { extractionSchema, standardInput } from "./validation.ts";
import type { Report } from "./types";
const outcome = z.enum(["pass", "fail", "review"]);
const standard = standardInput.and(
  z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    updatedAt: z.string().datetime(),
  }),
);
const report = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  image: z
    .string()
    .max(5_400_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  codeImage: z
    .string()
    .max(5_400_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  extraction: extractionSchema,
  productName: z.string().max(200),
  model: z.string().max(100),
  saved: z.boolean(),
  status: outcome,
  checks: z
    .array(
      z.object({
        field: z.string().max(200),
        observed: z.string().max(1200),
        expected: z.string().max(9000),
        status: outcome,
        reason: z.string().max(1200),
      }),
    )
    .min(1)
    .max(30),
  normalized: z.object({
    mfg: z.string().nullable(),
    exp: z.string().nullable(),
  }),
  standard: standard.nullable(),
  match: z.enum(["automatic", "selected", "remembered", "none", "ambiguous"]),
  corrections: z
    .array(
      z.object({
        at: z.string().datetime(),
        before: extractionSchema,
        after: extractionSchema,
      }),
    )
    .max(100),
});
export function validateBackup(data: unknown): Report[] {
  const parsed = z.array(report).max(500).safeParse(data);
  if (!parsed.success)
    throw new Error("ไฟล์สำรองมีข้อมูลไม่ถูกต้อง ยังไม่ได้นำเข้ารายงาน");
  const ids = new Set<string>();
  for (const r of parsed.data) {
    if (ids.has(r.id)) throw new Error("ไฟล์สำรองมีรหัสรายงานซ้ำ");
    ids.add(r.id);
  }
  return parsed.data as Report[];
}
