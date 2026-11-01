import type {
  Check,
  DateFormat,
  Extraction,
  InspectionResult,
  Standard,
} from "./types";
export const DATE_FORMATS: DateFormat[] = [
  "DD/MM/YYYY",
  "DD/MM/YY",
  "DD-MM-YYYY",
  "DD-MM-YY",
  "YYYY-MM-DD",
  "DD MMM YYYY",
  "DD MMM YY",
  "DDMMYYYY",
  "DDMMYY",
];
const months: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};
export const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
export const digits = (value: string) =>
  value.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664));
export function bangkokToday(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => p.find((v) => v.type === k)?.value)
    .join("-");
}
export function parsePrintedDate(
  raw: string,
  s: Pick<Standard, "dateFormat" | "calendar" | "twoDigitBase">,
): { iso: string | null; error: string | null } {
  const value = normalize(digits(raw));
  const patterns: Record<DateFormat, RegExp> = {
    "DD/MM/YYYY": /^(\d{2})\/(\d{2})\/(\d{4})$/,
    "DD/MM/YY": /^(\d{2})\/(\d{2})\/(\d{2})$/,
    "DD-MM-YYYY": /^(\d{2})-(\d{2})-(\d{4})$/,
    "DD-MM-YY": /^(\d{2})-(\d{2})-(\d{2})$/,
    "YYYY-MM-DD": /^(\d{4})-(\d{2})-(\d{2})$/,
    "DD MMM YYYY": /^(\d{2}) ([^\d]+) (\d{4})$/,
    "DD MMM YY": /^(\d{2}) ([^\d]+) (\d{2})$/,
    DDMMYYYY: /^(\d{2})(\d{2})(\d{4})$/,
    DDMMYY: /^(\d{2})(\d{2})(\d{2})$/,
  };
  const m = value.match(patterns[s.dateFormat]);
  if (!m) return { iso: null, error: "รูปแบบไม่ตรง " + s.dateFormat };
  let year = Number(s.dateFormat === "YYYY-MM-DD" ? m[1] : m[3]);
  const day = Number(s.dateFormat === "YYYY-MM-DD" ? m[3] : m[1]);
  const month = s.dateFormat.includes("MMM") ? months[m[2]] : Number(m[2]);
  if (s.dateFormat.endsWith("YY") && !s.dateFormat.endsWith("YYYY"))
    year += s.twoDigitBase;
  if (s.calendar === "BE") year -= 543;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2400 ||
    !month ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    return { iso: null, error: "วันที่ไม่มีจริงในปฏิทิน" };
  return { iso: d.toISOString().slice(0, 10), error: null };
}
export function addShelfLife(
  iso: string,
  amount: number,
  unit: "days" | "months",
): string {
  const d = new Date(iso + "T00:00:00Z");
  if (unit === "days") d.setUTCDate(d.getUTCDate() + amount);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + amount);
    const max = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, max));
  }
  return d.toISOString().slice(0, 10);
}
export function chooseStandard(
  e: Extraction,
  standards: Standard[],
  selectedId?: string | null,
  rememberedId?: string | null,
): { standard: Standard | null; match: InspectionResult["match"] } {
  const active = standards.filter((s) => s.enabled);
  if (selectedId)
    return {
      standard: active.find((s) => s.id === selectedId) ?? null,
      match: active.some((s) => s.id === selectedId) ? "selected" : "none",
    };
  if (e.ambiguousFields.includes("product"))
    return { standard: null, match: "ambiguous" };
  const ids = [e.sku, e.barcode]
    .filter((v): v is string => !!v?.trim())
    .map(normalize);
  const name = e.productName?.trim() ? normalize(e.productName) : null;
  const strong = active.filter((s) =>
    ids.some((v) => [s.sku, ...s.aliases].map(normalize).includes(v)),
  );
  const matches = strong.length
    ? strong
    : active.filter(
        (s) => name && [s.name, ...s.aliases].map(normalize).includes(name),
      );
  if (matches.length === 1) return { standard: matches[0], match: "automatic" };
  if (matches.length > 1) return { standard: null, match: "ambiguous" };
  // Never reuse a remembered product when visible identification conflicts.
  if (ids.length || name) return { standard: null, match: "none" };
  const last = active.find((s) => s.id === rememberedId);
  return { standard: last ?? null, match: last ? "remembered" : "none" };
}
export function inspect(
  e: Extraction,
  s: Standard | null,
  match: InspectionResult["match"] = "none",
  today = bangkokToday(),
): InspectionResult {
  const checks: Check[] = [];
  const normalized: { mfg: string | null; exp: string | null } = {
    mfg: null,
    exp: null,
  };
  const add = (
    field: string,
    observed: string,
    expected: string,
    status: Check["status"],
    reason: string,
  ) => checks.push({ field, observed, expected, status, reason });
  if (!s) {
    add(
      "Standard",
      e.productName || e.sku || "ระบุสินค้าไม่ได้",
      "Standard ที่เผยแพร่แล้ว",
      "review",
      match === "ambiguous"
        ? "พบหลาย Standard หรือชื่อสินค้าอ่านไม่ชัด กรุณาเลือกสินค้า"
        : "ไม่พบ Standard ที่ตรงกับสินค้า กรุณาเลือกสินค้าหรือให้ผู้ดูแลเพิ่ม Standard",
    );
    return { status: "review", checks, normalized, standard: null, match };
  }
  for (const f of ["mfg", "exp"] as const) {
    if (!s.required[f]) continue;
    const label = f === "mfg" ? "วันที่ผลิต" : "วันหมดอายุ";
    const raw = e[f];
    if (!raw || e.ambiguousFields.includes(f)) {
      add(
        label,
        raw || "อ่านไม่ได้",
        s.dateFormat,
        "review",
        "ข้อความไม่ชัดหรือไม่พบในภาพ ต้องตรวจภาพต้นฉบับ",
      );
      continue;
    }
    const p = parsePrintedDate(raw, s);
    normalized[f] = p.iso;
    add(
      label,
      raw,
      s.dateFormat + " · " + (s.calendar === "BE" ? "พ.ศ." : "ค.ศ."),
      p.error ? "fail" : "pass",
      p.error || "วันที่ถูกต้อง: " + p.iso,
    );
  }
  if (s.required.machine) {
    const raw = e.machine;
    if (!raw || e.ambiguousFields.includes("machine"))
      add(
        "เครื่องจักร",
        raw || "อ่านไม่ได้",
        s.machines.join(", "),
        "review",
        "ไม่สามารถยืนยันรหัสเครื่องจักรจากภาพ",
      );
    else {
      const valid = s.machines.some((v) => normalize(v) === normalize(raw));
      add(
        "เครื่องจักร",
        raw,
        s.machines.join(", "),
        valid ? "pass" : "fail",
        valid
          ? "ตรงกับเครื่องจักรที่อนุญาต"
          : "รหัสไม่อยู่ใน Standard (ไม่แทน O ด้วย 0 อัตโนมัติ)",
      );
    }
  }
  if (s.required.mfg && s.required.exp) {
    if (normalized.mfg && normalized.exp)
      add(
        "ลำดับวันที่",
        normalized.mfg + " → " + normalized.exp,
        "วันหมดอายุ ≥ วันผลิต",
        normalized.exp >= normalized.mfg ? "pass" : "fail",
        normalized.exp >= normalized.mfg
          ? "ลำดับวันที่ถูกต้อง"
          : "วันหมดอายุก่อนวันผลิต",
      );
    else
      add(
        "ลำดับวันที่",
        "ตรวจไม่ได้",
        "วันหมดอายุ ≥ วันผลิต",
        "review",
        "ต้องอ่านวันที่ทั้งสองให้ได้ก่อน",
      );
  }
  if (s.shelfLife !== null) {
    if (normalized.mfg && normalized.exp) {
      const expected = addShelfLife(normalized.mfg, s.shelfLife, s.shelfUnit);
      const valid = expected === normalized.exp;
      add(
        "อายุสินค้า",
        normalized.exp,
        expected +
          " (" +
          s.shelfLife +
          " " +
          (s.shelfUnit === "days" ? "วัน" : "เดือน") +
          " หลังผลิต)",
        valid ? "pass" : "fail",
        valid
          ? "อายุสินค้าตรงตาม Standard"
          : "วันหมดอายุไม่ตรงกับอายุสินค้าที่กำหนด",
      );
    } else
      add(
        "อายุสินค้า",
        "ตรวจไม่ได้",
        s.shelfLife + " " + (s.shelfUnit === "days" ? "วัน" : "เดือน"),
        "review",
        "ข้อมูลวันที่ไม่ครบสำหรับคำนวณ",
      );
  }
  if (s.checkExpired) {
    if (normalized.exp)
      add(
        "สถานะหมดอายุ",
        normalized.exp,
        "ไม่ก่อน " + today,
        normalized.exp >= today ? "pass" : "fail",
        normalized.exp >= today
          ? "ยังไม่หมดอายุ ณ วันที่ตรวจ"
          : "สินค้าหมดอายุแล้ว",
      );
    else
      add(
        "สถานะหมดอายุ",
        "ตรวจไม่ได้",
        "ไม่ก่อน " + today,
        "review",
        "อ่านวันหมดอายุไม่ได้",
      );
  }
  if (s.checkMfgToday) {
    if (normalized.mfg)
      add(
        "วันผลิตตรงวันตรวจ",
        normalized.mfg,
        today,
        normalized.mfg === today ? "pass" : "fail",
        normalized.mfg === today
          ? "ตรงกับวันที่ประเทศไทย"
          : "วันผลิตไม่ตรงกับวันตรวจตามกฎที่ผู้ดูแลกำหนด",
      );
    else
      add(
        "วันผลิตตรงวันตรวจ",
        "ตรวจไม่ได้",
        today,
        "review",
        "อ่านวันที่ผลิตไม่ได้",
      );
  }
  if (!checks.length)
    add(
      "Standard",
      "ไม่มีเงื่อนไขตรวจ",
      "อย่างน้อยหนึ่งเงื่อนไข",
      "review",
      "ยังไม่มีเงื่อนไขที่ใช้ยืนยันผล",
    );
  return {
    status: checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "review")
        ? "review"
        : "pass",
    checks,
    normalized,
    standard: s,
    match,
  };
}
