import { z } from "zod";
import { DATE_FORMATS } from "./inspection";
export const standardInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    sku: z.string().trim().min(1).max(80),
    aliases: z.array(z.string().trim().min(1).max(120)).max(30),
    required: z.object({
      mfg: z.boolean(),
      exp: z.boolean(),
      machine: z.boolean(),
    }),
    dateFormat: z.enum(
      DATE_FORMATS as [
        (typeof DATE_FORMATS)[number],
        ...(typeof DATE_FORMATS)[number][],
      ],
    ),
    calendar: z.enum(["CE", "BE"]),
    twoDigitBase: z
      .number()
      .int()
      .refine((n) => n === 2000 || n === 2500),
    shelfLife: z.number().int().min(1).max(36500).nullable(),
    shelfUnit: z.enum(["days", "months"]),
    checkExpired: z.boolean(),
    checkMfgToday: z.boolean(),
    machines: z.array(z.string().trim().min(1).max(80)).max(100),
    enabled: z.boolean(),
    revision: z.number().int().min(0).optional(),
  })
  .superRefine((s, c) => {
    const issue = (message: string) => c.addIssue({ code: "custom", message });
    if (!Object.values(s.required).some(Boolean))
      issue("ต้องเลือกอย่างน้อยหนึ่งรายการตรวจ");
    if (s.required.machine && !s.machines.length)
      issue("ต้องระบุเครื่องจักรที่อนุญาต");
    if (s.shelfLife !== null && (!s.required.mfg || !s.required.exp))
      issue("การตรวจอายุสินค้าต้องอ่านทั้งวันผลิตและวันหมดอายุ");
    if (s.checkExpired && !s.required.exp) issue("ต้องเปิดอ่านวันหมดอายุ");
    if (s.checkMfgToday && !s.required.mfg) issue("ต้องเปิดอ่านวันที่ผลิต");
    if (
      (s.calendar === "CE" && s.twoDigitBase !== 2000) ||
      (s.calendar === "BE" && s.twoDigitBase !== 2500)
    )
      issue("ฐานปีสองหลักไม่ตรงกับปฏิทิน");
  });
export const extractionSchema = z.object({
  rawText: z.string().max(12000),
  productName: z.string().max(200).nullable(),
  sku: z.string().max(100).nullable(),
  barcode: z.string().max(100).nullable(),
  mfg: z.string().max(100).nullable(),
  exp: z.string().max(100).nullable(),
  machine: z.string().max(100).nullable(),
  ambiguousFields: z.array(z.enum(["product", "mfg", "exp", "machine"])),
  notes: z.array(z.string().max(500)).max(20),
});
