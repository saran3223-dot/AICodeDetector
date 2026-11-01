import { z } from "zod";
import { DATE_FORMATS } from "./inspection.ts";
export const standardInput = z
  .object({
    kind: z.enum(["product", "printed_code"]).optional(),
    codeRule: z
      .object({
        lines: z.union([z.literal(1), z.literal(2)]),
        timeFormat: z.enum(["HH:MM", "HH:MM:SS"]),
        yearOffset: z.literal(1),
        machinePolicy: z.literal("presence"),
        minConfidence: z.literal(85),
      })
      .optional(),
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
    if (s.kind === "printed_code") {
      if (
        !s.codeRule ||
        s.calendar !== "CE" ||
        s.required.mfg ||
        !s.required.exp ||
        !s.required.machine ||
        s.shelfLife !== null ||
        s.checkMfgToday ||
        s.checkExpired
      )
        issue(
          "Standard Code ต้องใช้ปี ค.ศ. ตรวจเฉพาะวันหมดอายุ เวลา และการมีรหัส",
        );
      if (
        s.codeRule &&
        (s.codeRule.lines === 2
          ? s.dateFormat !== "DD/MM/YYYY" ||
            s.codeRule.timeFormat !== "HH:MM:SS"
          : s.dateFormat !== "DDMMYYYY" || s.codeRule.timeFormat !== "HH:MM")
      )
        issue("รูปแบบ Code ไม่ตรงกับจำนวนบรรทัด");
    } else if (s.codeRule) issue("codeRule ใช้ได้เฉพาะ Standard รูปแบบ Code");
    if (s.kind !== "printed_code" && s.required.machine && !s.machines.length)
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
  time: z.string().max(100).nullable().optional(),
  code: z
    .object({
      engine: z.literal("tesseract.js@7.0.0"),
      coordinateSpace: z.literal("source_pixels").optional(),
      initialText: z.string().max(12000).optional(),
      readings: z
        .array(
          z.object({
            date: z.string().max(100),
            confidence: z.number().min(0).max(100),
          }),
        )
        .max(20)
        .optional(),
      layout: z.union([z.literal(1), z.literal(2)]).nullable(),
      lines: z
        .array(
          z.object({
            text: z.string().max(2000),
            confidence: z.number().min(0).max(100),
            bbox: z.object({
              x0: z.number(),
              y0: z.number(),
              x1: z.number(),
              y1: z.number(),
            }),
            words: z
              .array(
                z.object({
                  text: z.string().max(500),
                  confidence: z.number().min(0).max(100),
                  bbox: z.object({
                    x0: z.number(),
                    y0: z.number(),
                    x1: z.number(),
                    y1: z.number(),
                  }),
                }),
              )
              .max(200),
          }),
        )
        .max(20),
      confidence: z.object({
        date: z.number().min(0).max(100),
        time: z.number().min(0).max(100),
        machine: z.number().min(0).max(100),
      }),
      ambiguous: z.array(z.enum(["date", "time", "machine", "layout"])),
      crop: z
        .object({
          x0: z.number(),
          y0: z.number(),
          x1: z.number(),
          y1: z.number(),
        })
        .optional(),
      manualFields: z.array(z.enum(["exp", "time", "machine"])).optional(),
      manualText: z.string().max(2000).optional(),
    })
    .optional(),
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
