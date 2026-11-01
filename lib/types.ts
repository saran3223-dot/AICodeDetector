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
  kind?: "product" | "printed_code";
  codeRule?: {
    lines: 1 | 2;
    timeFormat: "HH:MM" | "HH:MM:SS";
    yearOffset: 1;
    machinePolicy: "presence";
    minConfidence: number;
  };
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
  time?: string | null;
  code?: CodeEvidence;
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
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: Box;
}
export interface OcrLine {
  text: string;
  confidence: number;
  bbox: Box;
  words: OcrWord[];
}
export interface CodeEvidence {
  engine: "tesseract.js@7.0.0";
  lines: OcrLine[];
  layout: 1 | 2 | null;
  confidence: { date: number; time: number; machine: number };
  ambiguous: ("date" | "time" | "machine" | "layout")[];
  crop?: Box;
  manualFields?: ("exp" | "time" | "machine")[];
  manualText?: string;
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
  codeImage?: string;
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
  ocrMode?: "local";
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
