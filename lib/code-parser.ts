import type { Box, Extraction, OcrLine, OcrWord, Standard } from "./types";
export const DATE_CANDIDATE = /\b(?:\d{2}[\/.\-]\d{2}[\/.\-]\d{4}|\d{8})\b/;
const TIME_CANDIDATE = /\b\d{1,3}[:.]\d{1,3}(?:[:.]\d{1,3})?/;
function fieldConfidence(line: OcrLine, value: string): number {
  const related = line.words.filter(
    (w) =>
      w.text.includes(value) ||
      value.includes(w.text) ||
      w.text.replace(/\s/g, "").includes(value.replace(/\s/g, "")),
  );
  return related.length ? Math.min(...related.map((w) => w.confidence)) : 0;
}
export function groupPhysicalLines(input: OcrLine[]): OcrLine[] {
  const groups: OcrLine[][] = [];
  for (const l of input
    .filter((l) => l.text.trim())
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)) {
    const h = l.bbox.y1 - l.bbox.y0;
    const g = groups.find((g) => {
      const b = g[0].bbox;
      const bh = b.y1 - b.y0;
      return (
        Math.max(bh, h) <= Math.min(bh, h) * 2.5 &&
        Math.min(b.y1, l.bbox.y1) - Math.max(b.y0, l.bbox.y0) >
          Math.min(bh, h) * 0.45
      );
    });
    if (g) g.push(l);
    else groups.push([l]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const words = g
      .flatMap((l) => l.words)
      .sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return {
      text: g.reduce((text, l, i) => {
        if (!i) return l.text.trim();
        const previous = g[i - 1];
        const glyph = Math.min(
          (previous.bbox.x1 - previous.bbox.x0) /
            Math.max(1, previous.text.trim().length),
          (l.bbox.x1 - l.bbox.x0) / Math.max(1, l.text.trim().length),
        );
        const gap = l.bbox.x0 - previous.bbox.x1;
        return text + (gap >= glyph * 0.65 ? " " : "") + l.text.trim();
      }, ""),
      confidence: Math.min(...g.map((l) => l.confidence)),
      bbox: {
        x0: Math.min(...g.map((l) => l.bbox.x0)),
        y0: Math.min(...g.map((l) => l.bbox.y0)),
        x1: Math.max(...g.map((l) => l.bbox.x1)),
        y1: Math.max(...g.map((l) => l.bbox.y1)),
      },
      words,
    };
  });
}
export function extractPrintedCode(
  input: OcrLine[],
  rawText: string,
): Extraction {
  const lines = groupPhysicalLines(input);
  const candidates: {
    date: string;
    time: string | null;
    machine: string | null;
    lines: OcrLine[];
  }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const d = l.text.match(DATE_CANDIDATE);
    if (!d) continue;
    const date = d[0];
    const after = l.text.slice((d.index ?? 0) + date.length);
    let t = after.match(TIME_CANDIDATE);
    let selected = [l],
      tail = after;
    if (!t) {
      const next = lines[i + 1];
      if (next) {
        const h = Math.max(l.bbox.y1 - l.bbox.y0, next.bbox.y1 - next.bbox.y0);
        const near =
          next.bbox.y0 - l.bbox.y1 < h * 2 &&
          Math.abs(next.bbox.x0 - l.bbox.x0) <
            Math.max(h * 3, l.bbox.x1 - l.bbox.x0);
        if (near && TIME_CANDIDATE.test(next.text)) {
          selected = [l, next];
          tail = next.text;
          t = tail.match(TIME_CANDIDATE);
        }
      }
    }
    if (!t) continue;
    const machineTail = tail.slice((t.index ?? 0) + t[0].length).trim();
    const machine = machineTail.match(/^[A-Za-z0-9]+$/)?.[0] ?? null;
    candidates.push({ date, time: t[0], machine, lines: selected });
  }
  const selected = candidates[0];
  const ambiguous = candidates.length > 1;
  const result: Extraction = {
    rawText,
    productName: null,
    sku: null,
    barcode: null,
    mfg: null,
    exp: selected?.date ?? null,
    time: selected?.time ?? null,
    machine: selected?.machine ?? null,
    ambiguousFields: [],
    notes: [],
    code: {
      engine: "tesseract.js@7.0.0",
      lines: selected?.lines ?? [],
      layout:
        selected?.lines.length === 1
          ? 1
          : selected?.lines.length === 2
            ? 2
            : null,
      confidence: { date: 0, time: 0, machine: 0 },
      ambiguous: ambiguous ? ["date", "time", "machine", "layout"] : [],
    },
  };
  if (selected) {
    const timeLine = selected.lines.at(-1)!;
    result.code!.confidence = {
      date: fieldConfidence(selected.lines[0], selected.date),
      time: fieldConfidence(timeLine, selected.time || ""),
      machine: selected.machine
        ? fieldConfidence(timeLine, selected.machine)
        : 0,
    };
    // OCR may invent a word space. Require visible separation in word boxes too.
    if (selected.machine) {
      const words = timeLine.words;
      const machineWord = words.findLast((w) => w.text === selected.machine);
      const previous = machineWord && words[words.indexOf(machineWord) - 1];
      if (machineWord && previous) {
        const glyph =
          (machineWord.bbox.x1 - machineWord.bbox.x0) /
          Math.max(1, machineWord.text.length);
        if (machineWord.bbox.x0 - previous.bbox.x1 < glyph * 0.65)
          result.code!.ambiguous.push("layout");
      }
    }
  }
  if (ambiguous)
    result.notes.push("พบโค้ดหลายชุดในภาพ กรุณาครอบบริเวณที่ต้องการตรวจ");
  if (!selected)
    result.notes.push(
      "ยังแยกวันที่และเวลาไม่ได้ กรุณาครอบเฉพาะโค้ดหรือถ่ายภาพให้ชัดขึ้น",
    );
  return result;
}
export function selectCodeStandard(
  e: Extraction,
  standards: Standard[],
): Standard | null {
  const count =
    e.exp?.includes("/") || e.exp?.includes("-") || e.exp?.includes(".")
      ? 2
      : e.exp?.length === 8
        ? 1
        : e.code?.layout;
  return (
    standards.find(
      (s) =>
        s.kind === "printed_code" && s.enabled && s.codeRule?.lines === count,
    ) ?? null
  );
}
export function codeRegion(e: Extraction): Box | null {
  const l = e.code?.lines;
  if (!l?.length) return null;
  const h = Math.max(...l.map((x) => x.bbox.y1 - x.bbox.y0));
  return {
    x0: Math.min(...l.map((x) => x.bbox.x0)) - h * 0.6,
    y0: Math.min(...l.map((x) => x.bbox.y0)) - h * 0.4,
    x1: Math.max(...l.map((x) => x.bbox.x1)) + h * 0.6,
    y1: Math.max(...l.map((x) => x.bbox.y1)) + h * 0.4,
  };
}
