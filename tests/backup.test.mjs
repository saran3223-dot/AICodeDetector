import test from "node:test";
import assert from "node:assert/strict";
import { validateBackup } from "../lib/backup.ts";
import { CODE_STANDARDS } from "../lib/code-standards.ts";
import { extractPrintedCode } from "../lib/code-parser.ts";
import { inspect } from "../lib/inspection.ts";
const oldStandard = {
  ...CODE_STANDARDS[0],
  kind: undefined,
  codeRule: undefined,
  sku: "OLD",
  required: { mfg: true, exp: true, machine: true },
  shelfLife: 30,
  machines: ["MC-01"],
};
const oldExtraction = {
  rawText: "MFG 01/11/2026 EXP 01/12/2026 MC-01",
  productName: null,
  sku: null,
  barcode: null,
  mfg: "01/11/2026",
  exp: "01/12/2026",
  machine: "MC-01",
  ambiguousFields: [],
  notes: [],
};
function report(extraction, standard = oldStandard) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-11-01T00:00:00Z",
    image: "data:image/jpeg;base64,aGVsbG8=",
    extraction,
    productName: "QA",
    model: "test",
    saved: true,
    corrections: [],
    ...inspect(extraction, standard, "selected", "2026-11-01"),
  };
}
test("legacy reports without OCR metadata remain importable", () => {
  const r = JSON.parse(JSON.stringify(report(oldExtraction)));
  const [parsed] = validateBackup([r]);
  assert.deepEqual(parsed, r);
});
test("new report backup preserves code image, time, geometry, confidence and audit", () => {
  const e = extractPrintedCode([], "");
  e.time = "12:47";
  e.code.crop = { x0: 1, y0: 2, x1: 20, y1: 30 };
  e.code.manualFields = ["exp", "time", "machine"];
  e.code.coordinateSpace = "source_pixels";
  e.code.initialText = "29/09/2021";
  e.code.readings = [
    { date: "29/09/2021", confidence: 54 },
    { date: "29/09/2027", confidence: 82 },
  ];
  e.code.manualText = "20102027 12:47 BB";
  e.exp = "20102027";
  e.machine = "BB";
  const r = report(e, CODE_STANDARDS[1]);
  r.codeImage = r.image;
  r.corrections = [{ at: r.createdAt, before: oldExtraction, after: e }];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify([r]))), [r]);
});
test("malformed backup and duplicate IDs are rejected before import", () => {
  const r = report(oldExtraction);
  assert.throws(() => validateBackup([{ ...r, image: "javascript:alert(1)" }]));
  assert.throws(() => validateBackup([r, r]));
  assert.throws(() =>
    validateBackup([
      { ...r, extraction: { ...oldExtraction, code: { engine: "unknown" } } },
    ]),
  );
});
