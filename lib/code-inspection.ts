import type { Check, Extraction, InspectionResult, Standard } from "./types";
import { parsePrintedDate, bangkokToday } from "./inspection.ts";
export function inspectCode(
  e: Extraction,
  s: Standard,
  match: InspectionResult["match"],
  today = bangkokToday(),
): InspectionResult {
  const checks: Check[] = [];
  const normalized = { mfg: null, exp: null as string | null };
  const add = (
    field: string,
    observed: string,
    expected: string,
    status: Check["status"],
    reason: string,
  ) => checks.push({ field, observed, expected, status, reason });
  const rule = s.codeRule!;
  const code = e.code;
  const manual = new Set(code?.manualFields ?? []);
  const manualLayout =
    !!code?.manualText &&
    (["exp", "time", "machine"] as const).every((f) => manual.has(f));
  const confident = (f: "date" | "time" | "machine") =>
    !!code &&
    (manual.has(f === "date" ? "exp" : f) ||
      (!code.ambiguous.includes(f) &&
        code.confidence[f] >= rule.minConfidence));
  const expectedYear = Number(today.slice(0, 4)) + rule.yearOffset;
  const date = e.exp;
  if (!date || !confident("date")) {
    add(
      "วันควรบริโภคก่อน",
      date || "อ่านไม่ได้",
      s.dateFormat,
      "review",
      "อ่านข้อความวันที่ไม่มั่นใจพอ ต้องตรวจภาพต้นฉบับ",
    );
    add(
      "ปี ค.ศ.",
      date?.slice(-4) || "อ่านไม่ได้",
      String(expectedYear),
      "review",
      "ต้องยืนยันวันที่ก่อนตรวจปี",
    );
  } else {
    const p = parsePrintedDate(date, s);
    normalized.exp = p.iso;
    add(
      "วันควรบริโภคก่อน",
      date,
      s.dateFormat,
      p.error ? "fail" : "pass",
      p.error || "วันที่มีจริง: " + p.iso,
    );
    const y = date.match(/(\d{4})$/)?.[1];
    add(
      "ปี ค.ศ.",
      y || "ไม่พบปีสี่หลัก",
      String(expectedYear),
      y === String(expectedYear) ? "pass" : "fail",
      "ปีที่ตรวจ " +
        today.slice(0, 4) +
        " + 1 ตามเวลาไทย ไม่บังคับวันเดือนให้ตรงวันตรวจ",
    );
  }
  const time = e.time;
  const timeRegex =
    rule.lines === 2 ? /^(\d{2}):(\d{2}):(\d{2})$/ : /^(\d{2}):(\d{2})$/;
  if (!time || !confident("time"))
    add(
      "เวลา",
      time || "อ่านไม่ได้",
      rule.timeFormat,
      "review",
      "อ่านเวลาไม่มั่นใจพอ หรือมีตัวคั่นที่กำกวม",
    );
  else {
    const t = time.match(timeRegex);
    const valid =
      !!t &&
      Number(t[1]) <= 23 &&
      Number(t[2]) <= 59 &&
      (t[3] === undefined || Number(t[3]) <= 59);
    add(
      "เวลา",
      time,
      rule.timeFormat,
      valid ? "pass" : "fail",
      valid
        ? "รูปแบบเวลา 24 ชั่วโมงถูกต้อง ไม่เทียบเวลาปัจจุบัน"
        : "รูปแบบเวลาหรือช่วงชั่วโมง/นาที/วินาทีไม่ถูกต้อง",
    );
  }
  if (!e.machine || !confident("machine"))
    add(
      "รหัสเครื่อง",
      e.machine || "อ่านไม่ได้",
      "ตัวอักษรอังกฤษหรือตัวเลขหลังเวลา",
      "review",
      "ยังยืนยันรหัสจากภาพไม่ได้ · ตรวจเฉพาะการมีรหัส",
    );
  else
    add(
      "รหัสเครื่อง",
      e.machine,
      "ตัวอักษรอังกฤษหรือตัวเลข",
      /^[A-Za-z0-9]+$/.test(e.machine) ? "pass" : "fail",
      "ตรวจเฉพาะการมีรหัส ไม่ได้เทียบรายชื่อเครื่องที่อนุญาต",
    );
  const lines = code?.lines ?? [];
  const reliable =
    manualLayout ||
    (!!code &&
      !code.ambiguous.includes("layout") &&
      confident("date") &&
      confident("time") &&
      confident("machine"));
  if (!reliable)
    add(
      "จำนวนบรรทัดและช่องว่าง",
      lines.map((l) => l.text.trim()).join(" ⏎ ") || "ยืนยันไม่ได้",
      rule.lines + " บรรทัด · มีช่องว่างคั่นเวลาและรหัส",
      "review",
      "ต้องมีหลักฐานตำแหน่งและข้อความที่ชัดเจน ห้ามเติมตัวคั่นเพื่อให้ผ่าน",
    );
  else {
    const pattern =
      rule.lines === 2
        ? /^\d{2}\/\d{2}\/\d{4}\n\d{2}:\d{2}:\d{2}[ \t]+[A-Za-z0-9]+$/
        : /^\d{8}[ \t]+\d{2}:\d{2}[ \t]+[A-Za-z0-9]+$/;
    const raw = code?.manualText ?? lines.map((l) => l.text.trim()).join("\n");
    const ok = raw.split("\n").length === rule.lines && pattern.test(raw);
    add(
      "จำนวนบรรทัดและช่องว่าง",
      raw,
      rule.lines === 2
        ? "DD/MM/YYYY ⏎ HH:MM:SS รหัสเครื่อง"
        : "DDMMYYYY HH:MM รหัสเครื่อง",
      ok ? "pass" : "fail",
      ok
        ? manualLayout
          ? "โครงสร้างตามข้อความที่ผู้ใช้ยืนยันจากภาพ · เก็บผล OCR เดิม"
          : "โครงสร้างและช่องว่างตรง Standard"
        : "จำนวนบรรทัด รูปแบบ หรือช่องว่างไม่ตรง Standard",
    );
  }
  return {
    status: checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "review")
        ? "review"
        : "pass",
    checks,
    normalized,
    standard: structuredClone(s),
    match,
  };
}
