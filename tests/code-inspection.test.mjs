import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "../lib/inspection.ts";
import { CODE_STANDARDS } from "../lib/code-standards.ts";
import {
  extractPrintedCode,
  selectCodeStandard,
  groupPhysicalLines,
} from "../lib/code-parser.ts";
const two = CODE_STANDARDS[0],
  one = CODE_STANDARDS[1],
  today = "2026-11-01";
function lines(text, confidence = 96) {
  return text.split("\n").map((text, i) => ({
    text,
    confidence,
    bbox: {
      x0: 10,
      y0: 10 + i * 40,
      x1: 10 + text.length * 14,
      y1: 35 + i * 40,
    },
    words: text.split(/ +/).map((text, j) => ({
      text,
      confidence,
      bbox: {
        x0: 10 + j * 120,
        y0: 10 + i * 40,
        x1: 100 + j * 120,
        y1: 35 + i * 40,
      },
    })),
  }));
}
function extract(text, confidence = 96) {
  return extractPrintedCode(lines(text, confidence), text);
}
function result(text, s = two, c = 96) {
  return inspect(extract(text, c), s, "automatic", today);
}
test("two-line code checks EXP without manufacturing date", () => {
  const r = result("23/09/2027\n16:00:32 BB");
  assert.equal(r.status, "pass");
  assert.equal(r.normalized.mfg, null);
  assert.equal(r.normalized.exp, "2027-09-23");
  assert.ok(!r.checks.some((c) => c.field === "วันที่ผลิต"));
});
test("one-line compact code passes and selects preset", () => {
  const e = extract("20102027 12:47 BB");
  assert.equal(inspect(e, one, "automatic", today).status, "pass");
  assert.equal(selectCodeStandard(e, CODE_STANDARDS).id, one.id);
});
test("only year is constrained, day/month may differ from inspection", () =>
  assert.equal(result("01/01/2027\n00:00:00 X1").status, "pass"));
test("wrong year is a proven failure", () =>
  assert.equal(result("23/09/2026\n16:00:32 BB").status, "fail"));
test("year rolls over at Bangkok midnight", () => {
  const e = extract("01/01/2027\n00:00:00 BB");
  assert.equal(inspect(e, two, "automatic", "2026-12-31").status, "pass");
  assert.equal(inspect(e, two, "automatic", "2027-01-01").status, "fail");
});
test("invalid calendar date fails", () =>
  assert.equal(result("31/02/2027\n16:00:32 BB").status, "fail"));
test("hour minute and second limits are validated", () => {
  for (const t of ["24:00:00", "23:60:00", "23:59:60"])
    assert.equal(result("23/09/2027\n" + t + " BB").status, "fail");
});
test("two-line requires seconds and one-line disallows seconds", () => {
  assert.equal(result("23/09/2027\n16:00 BB").status, "fail");
  assert.equal(result("20102027 12:47:01 BB", one).status, "fail");
});
test("wrong separators are preserved and fail, never repaired", () => {
  const e = extract("23-09-2027\n16.00.32 BB");
  assert.equal(e.exp, "23-09-2027");
  assert.equal(e.time, "16.00.32");
  assert.equal(inspect(e, two, "automatic", today).status, "fail");
});
test("one-line must not accept slashed date", () =>
  assert.equal(result("20/10/2027 12:47 BB", one).status, "fail"));
test("two-line date plus time on same line fails layout", () =>
  assert.equal(result("23/09/2027 16:00:32 BB").status, "fail"));
test("space before machine is required; extra spaces are accepted", () => {
  assert.equal(result("23/09/2027\n16:00:32BB").status, "fail");
  assert.equal(result("23/09/2027\n16:00:32   BB").status, "pass");
});
test("machine is presence-only and arbitrary alphanumeric codes pass", () => {
  const r = result("23/09/2027\n16:00:32 DD01");
  assert.equal(r.status, "pass");
  assert.match(
    r.checks.find((c) => c.field === "รหัสเครื่อง").reason,
    /เฉพาะการมีรหัส/,
  );
});
test("low-confidence data requires review, not fail or pass", () => {
  assert.equal(result("23/09/2021\n16:00:32 BB", two, 60).status, "review");
  assert.equal(result("23/09/2027\n16:00:32 BB", two, 84).status, "review");
});
test("each field must meet confidence gate, overall page average is insufficient", () => {
  const e = extract("23/09/2027\n16:00:32 BB");
  e.code.confidence.machine = 20;
  assert.equal(inspect(e, two, "automatic", today).status, "review");
});
test("multiple code regions require review", () => {
  const e = extract("23/09/2027\n16:00:32 BB\n20/10/2027\n13:07:13 DD01");
  assert.ok(e.code.ambiguous.includes("layout"));
  assert.notEqual(inspect(e, two, "automatic", today).status, "pass");
});
test("no code or unreadable image can never pass", () => {
  const e = extract("BEST BEFORE\nunreadable");
  assert.equal(selectCodeStandard(e, CODE_STANDARDS), null);
  assert.equal(inspect(e, null).status, "review");
});
test("missing machine requires review and can never pass", () =>
  assert.equal(result("23/09/2027\n16:00:32").status, "review"));
test("proven invalid time overrides uncertain machine", () => {
  const e = extract("23/09/2027\n24:00:00 BB");
  e.code.confidence.machine = 20;
  assert.equal(inspect(e, two, "automatic", today).status, "fail");
});
test("human confirmation is explicit and preserves original OCR", () => {
  const e = extract("23/09/2027\n16:00:32 BB", 40);
  const old = structuredClone(e);
  e.code.manualText = "23/09/2027\n16:00:32 BB";
  e.code.manualFields = ["exp", "time", "machine"];
  const r = inspect(e, two, "selected", today);
  assert.equal(r.status, "pass");
  assert.equal(old.code.confidence.date, 40);
  assert.match(r.checks.at(-1).reason, /ผู้ใช้ยืนยัน/);
});
test("manual transcription cannot pass an actually invalid format", () => {
  const e = extract("23/09/2027\n16:00:32BB", 40);
  e.code.manualText = "23/09/2027\n16:00:32BB";
  e.code.manualFields = ["exp", "time", "machine"];
  assert.equal(inspect(e, two, "selected", today).status, "fail");
});
test("disabled code presets are not selected", () =>
  assert.equal(
    selectCodeStandard(extract("20102027 12:47 BB"), [
      { ...one, enabled: false },
    ]),
    null,
  ));
test("report stores frozen standard snapshot", () => {
  const s = structuredClone(two);
  const r = inspect(extract("23/09/2027\n16:00:32 BB"), s, "automatic", today);
  s.codeRule.minConfidence = 1;
  assert.equal(r.standard.codeRule.minConfidence, 85);
});
test("tall packaging text cannot swallow the code line", () => {
  const code = lines("20102027 12:47 BB");
  const noise = {
    text: "I",
    confidence: 93,
    bbox: { x0: 1, y0: 0, x1: 8, y1: 800 },
    words: [],
  };
  const e = extractPrintedCode([noise, ...code], "I\n20102027 12:47 BB");
  assert.equal(e.exp, "20102027");
  assert.equal(inspect(e, one, "automatic", today).status, "pass");
});
test("physical line fragments do not gain invented spaces", () => {
  const [l] = lines("20102027 12:47");
  const [r] = lines("BB");
  r.bbox = { x0: l.bbox.x1 + 1, y0: 10, x1: l.bbox.x1 + 29, y1: 35 };
  r.words = [{ text: "BB", confidence: 96, bbox: r.bbox }];
  const grouped = groupPhysicalLines([l, r]);
  assert.equal(grouped[0].text, "20102027 12:47BB");
  assert.notEqual(
    inspect(
      extractPrintedCode(grouped, grouped[0].text),
      one,
      "automatic",
      today,
    ).status,
    "pass",
  );
});
test("missing or excess seconds digits cannot be silently truncated", () => {
  for (const time of ["16:00:3", "16:00:321", "123:00:32", "16:000:32"]) {
    const e = extract("23/09/2027\n" + time + " BB");
    assert.equal(e.time, time);
    assert.equal(inspect(e, two, "automatic", today).status, "fail");
  }
});
