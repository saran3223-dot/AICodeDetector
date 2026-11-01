export type Outcome = "pass" | "fail" | "review";
export type DateFormat =
  | "DD/MM/YYYY"
  | "DD/MM/YY"
  | "DD-MM-YYYY"
  | "DD-MM-YY"
  | "YYYY-MM-DD"
  | "DD MMM YYYY"
  | "DD MMM YY"
  | "DDMMYYYY"
  | "DDMMYY";
export interface Standard {
  id: string;
  name: string;
  sku: string;
  aliases: string[];
  required: { mfg: boolean; exp: boolean; machine: boolean };
  dateFormat: DateFormat;
  calendar: "CE" | "BE";
  twoDigitBase: number;
  shelfLife: number | null;
  shelfUnit: "days" | "months";
  checkExpired: boolean;
  checkMfgToday: boolean;
  machines: string[];
  enabled: boolean;
  revision: number;
  updatedAt: string;
}
export interface Extraction {
  rawText: string;
  productName: string | null;
  sku: string | null;
  barcode: string | null;
  mfg: string | null;
  exp: string | null;
  machine: string | null;
  ambiguousFields: ("product" | "mfg" | "exp" | "machine")[];
  notes: string[];
}
export interface Check {
  field: string;
  observed: string;
  expected: string;
  status: Outcome;
  reason: string;
}
export interface InspectionResult {
  status: Outcome;
  checks: Check[];
  normalized: { mfg: string | null; exp: string | null };
  standard: Standard | null;
  match: "automatic" | "selected" | "remembered" | "none" | "ambiguous";
}
export interface Report extends InspectionResult {
  id: string;
  createdAt: string;
  image: string;
  extraction: Extraction;
  productName: string;
  model: string;
  saved: boolean;
  corrections: { at: string; before: Extraction; after: Extraction }[];
}
export interface ServiceConfig {
  aiReady: boolean;
  lineReady: boolean;
  liffId: string;
  admin: boolean;
  signedIn: boolean;
  standardsReady: boolean;
}
export const outcomeLabel: Record<Outcome, string> = {
  pass: "ผ่านมาตรฐาน",
  fail: "ไม่ผ่านมาตรฐาน",
  review: "ต้องตรวจซ้ำ",
};
