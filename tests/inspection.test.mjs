import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePrintedDate,
  addShelfLife,
  chooseStandard,
  inspect,
  bangkokToday,
} from "../lib/inspection.ts";
const standard = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "TEST PRODUCT",
  sku: "TEST-001",
  aliases: ["8850000000001"],
  required: { mfg: true, exp: true, machine: true },
  dateFormat: "DD/MM/YYYY",
  calendar: "CE",
  twoDigitBase: 2000,
  shelfLife: 30,
  shelfUnit: "days",
  checkExpired: false,
  checkMfgToday: false,
  machines: ["MC-01"],
  enabled: true,
  revision: 1,
  updatedAt: "2026-11-01T00:00:00Z",
};
const extraction = {
  rawText: "TEST PRODUCT MFG 01/11/2026 EXP 01/12/2026 MC-01",
  productName: "TEST PRODUCT",
  sku: "TEST-001",
  barcode: null,
  mfg: "01/11/2026",
  exp: "01/12/2026",
  machine: "MC-01",
  ambiguousFields: [],
  notes: [],
};
test("valid date and actual leap year", () => {
  assert.equal(parsePrintedDate("29/02/2024", standard).iso, "2024-02-29");
  assert.equal(parsePrintedDate("29/02/2025", standard).iso, null);
  assert.equal(parsePrintedDate("31/04/2026", standard).iso, null);
});
test("strict format does not silently swap month/day", () => {
  assert.equal(parsePrintedDate("2026-11-01", standard).iso, null);
  assert.equal(parsePrintedDate("13/12/2026", standard).iso, "2026-12-13");
});
test("Thai digits and Buddhist calendar", () => {
  assert.equal(
    parsePrintedDate("๐๑/๑๑/๒๕๖๙", {
      ...standard,
      calendar: "BE",
      twoDigitBase: 2500,
    }).iso,
    "2026-11-01",
  );
});
test("two digit year uses explicit calendar base", () => {
  assert.equal(
    parsePrintedDate("01/11/26", { ...standard, dateFormat: "DD/MM/YY" }).iso,
    "2026-11-01",
  );
  assert.equal(
    parsePrintedDate("01/11/69", {
      ...standard,
      dateFormat: "DD/MM/YY",
      calendar: "BE",
      twoDigitBase: 2500,
    }).iso,
    "2026-11-01",
  );
});
test("textual English and Thai month", () => {
  assert.equal(
    parsePrintedDate("01 NOV 2026", { ...standard, dateFormat: "DD MMM YYYY" })
      .iso,
    "2026-11-01",
  );
  assert.equal(
    parsePrintedDate("01 พ.ย. 2569", {
      ...standard,
      dateFormat: "DD MMM YYYY",
      calendar: "BE",
    }).iso,
    "2026-11-01",
  );
});
test("compact and ISO dates", () => {
  assert.equal(
    parsePrintedDate("01112026", { ...standard, dateFormat: "DDMMYYYY" }).iso,
    "2026-11-01",
  );
  assert.equal(
    parsePrintedDate("2026-11-01", { ...standard, dateFormat: "YYYY-MM-DD" })
      .iso,
    "2026-11-01",
  );
});
test("shelf life clamps month-end and crosses year", () => {
  assert.equal(addShelfLife("2026-01-31", 1, "months"), "2026-02-28");
  assert.equal(addShelfLife("2024-01-31", 1, "months"), "2024-02-29");
  assert.equal(addShelfLife("2026-12-31", 1, "days"), "2027-01-01");
});
test("correct inspection passes", () =>
  assert.equal(
    inspect(extraction, standard, "automatic", "2026-11-01").status,
    "pass",
  ));
test("machine mismatch fails and does not substitute O for zero", () =>
  assert.equal(
    inspect({ ...extraction, machine: "MC-O1" }, standard).status,
    "fail",
  ));
test("wrong shelf life fails", () =>
  assert.equal(
    inspect({ ...extraction, exp: "02/12/2026" }, standard).status,
    "fail",
  ));
test("invalid date fails", () =>
  assert.equal(
    inspect({ ...extraction, mfg: "31/11/2026" }, standard).status,
    "fail",
  ));
test("missing or ambiguous data requires review", () => {
  assert.equal(
    inspect({ ...extraction, mfg: null }, standard).status,
    "review",
  );
  assert.equal(
    inspect({ ...extraction, ambiguousFields: ["exp"] }, standard).status,
    "review",
  );
});
test("proven failure takes priority over unreadable field", () =>
  assert.equal(
    inspect({ ...extraction, mfg: null, machine: "MC-99" }, standard).status,
    "fail",
  ));
test("no standard can never pass", () =>
  assert.equal(inspect(extraction, null).status, "review"));
test("expiry before production fails", () =>
  assert.equal(
    inspect(
      { ...extraction, exp: "01/10/2026" },
      { ...standard, shelfLife: null },
    ).status,
    "fail",
  ));
test("optional expiry uses inspection day, inclusive expiry date", () => {
  assert.equal(
    inspect(
      extraction,
      { ...standard, checkExpired: true },
      "automatic",
      "2026-12-01",
    ).status,
    "pass",
  );
  assert.equal(
    inspect(
      extraction,
      { ...standard, checkExpired: true },
      "automatic",
      "2026-12-02",
    ).status,
    "fail",
  );
});
test("optional manufacturing day must match Bangkok date", () =>
  assert.equal(
    inspect(
      extraction,
      { ...standard, checkMfgToday: true },
      "automatic",
      "2026-11-02",
    ).status,
    "fail",
  ));
test("Bangkok date rolls over ahead of UTC", () =>
  assert.equal(bangkokToday(new Date("2026-10-31T18:00:00Z")), "2026-11-01"));
test("automatic SKU and barcode match", () => {
  assert.equal(chooseStandard(extraction, [standard]).match, "automatic");
  assert.equal(
    chooseStandard(
      { ...extraction, sku: null, productName: null, barcode: "8850000000001" },
      [standard],
    ).standard.id,
    standard.id,
  );
});
test("unknown visible product never uses remembered standard", () =>
  assert.equal(
    chooseStandard(
      { ...extraction, productName: "OTHER", sku: "OTHER" },
      [standard],
      null,
      standard.id,
    ).standard,
    null,
  ));
test("date-only image uses remembered product with explicit provenance", () =>
  assert.equal(
    chooseStandard(
      { ...extraction, productName: null, sku: null },
      [standard],
      null,
      standard.id,
    ).match,
    "remembered",
  ));
test("duplicate/ambiguous product match requires choice", () => {
  assert.equal(
    chooseStandard(extraction, [standard, { ...standard, id: "another" }])
      .match,
    "ambiguous",
  );
  assert.equal(
    chooseStandard({ ...extraction, ambiguousFields: ["product"] }, [standard])
      .match,
    "ambiguous",
  );
});
test("disabled standard is never selected", () =>
  assert.equal(
    chooseStandard(extraction, [{ ...standard, enabled: false }], standard.id)
      .standard,
    null,
  ));
test("report snapshot remains stable when source standard changes", () => {
  const snapshot = structuredClone(inspect(extraction, standard));
  standard.machines.push("MC-02");
  assert.deepEqual(snapshot.standard.machines, ["MC-01"]);
  standard.machines.pop();
});
