import type { Worker, Page, PSM, ImageLike } from "tesseract.js";
import type { Box, Extraction, OcrLine } from "./types";
import { extractPrintedCode, codeRegion } from "./code-parser";
import { preprocessPixels } from "./ocr-pixels";
import { connectDotMatrix, sampleDotRow } from "./dot-matrix";
import { loadImage } from "./report-image";
let workerPromise: Promise<Worker> | null = null;
let generation = 0;
let logger: ((progress: number, message: string) => void) | null = null;
let running = false;
function stopWorker() {
  generation++;
  const promise = workerPromise;
  workerPromise = null;
  void promise?.then((w) => w.terminate()).catch(() => {});
}
async function worker() {
  if (!workerPromise) {
    const token = generation;
    workerPromise = import("tesseract.js").then(async (t) => {
      const w = await t.createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        gzip: true,
        workerBlobURL: false,
        cacheMethod: "write",
        logger: (m) =>
          logger?.(
            m.progress,
            m.status === "recognizing text"
              ? "กำลังอ่านข้อความ"
              : m.status.includes("language")
                ? "กำลังโหลดโมเดลอ่านอักษร"
                : "กำลังเตรียมตัวอ่านในเครื่อง",
          ),
      });
      if (token !== generation) {
        await w.terminate();
        throw new DOMException("ยกเลิกการอ่าน", "AbortError");
      }
      await w.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return w;
    });
    const pending = workerPromise;
    workerPromise.catch(() => {
      if (workerPromise === pending) workerPromise = null;
    });
  }
  return workerPromise;
}
function flatten(data: Page): OcrLine[] {
  return (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.map((l) => ({
        text: l.text.trim(),
        confidence: l.confidence,
        bbox: l.bbox,
        words: l.words.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox,
        })),
      })),
    ),
  );
}
export function boundCrop(box: Box, width: number, height: number): Box {
  const x0 = Math.max(0, Math.min(width - 1, box.x0)),
    y0 = Math.max(0, Math.min(height - 1, box.y0));
  return {
    x0,
    y0,
    x1: Math.max(x0 + 1, Math.min(width, box.x1)),
    y1: Math.max(y0 + 1, Math.min(height, box.y1)),
  };
}
function draw(image: HTMLImageElement, box?: Box, longSide = 2400) {
  const b = boundCrop(
    box ?? { x0: 0, y0: 0, x1: image.naturalWidth, y1: image.naturalHeight },
    image.naturalWidth,
    image.naturalHeight,
  );
  const w = b.x1 - b.x0,
    h = b.y1 - b.y0;
  const scale = Math.min(
    longSide / Math.max(w, h),
    Math.sqrt(4_000_000 / (w * h)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas
    .getContext("2d", { willReadFrequently: true })!
    .drawImage(image, b.x0, b.y0, w, h, 0, 0, canvas.width, canvas.height);
  return { canvas, box: b, scale };
}
function processed(canvas: HTMLCanvasElement, dots: boolean, crop: boolean) {
  const target = document.createElement("canvas");
  target.width = canvas.width;
  target.height = canvas.height;
  const c = target.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(canvas, 0, 0);
  const data = c.getImageData(0, 0, target.width, target.height);
  data.data.set(
    preprocessPixels(
      data.data,
      target.width,
      target.height,
      dots,
      crop ? Math.round(target.width / 400) : 2,
    ),
  );
  c.putImageData(data, 0, 0);
  return target;
}
function score(e: Extraction) {
  const c = e.code!;
  return (
    (e.exp ? 100 : 0) +
    (e.time ? 80 : 0) +
    (e.machine ? 30 : 0) +
    (c.confidence.date + c.confidence.time + c.confidence.machine) * 0.3 +
    Math.min(c.confidence.date, c.confidence.time, c.confidence.machine) * 0.3
  );
}
export async function recognizeLocal(
  source: string,
  options: {
    crop?: Box;
    signal: AbortSignal;
    onProgress: (progress: number, message: string) => void;
  },
): Promise<{ extraction: Extraction; codeImage?: string; model: string }> {
  if (running) throw new Error("กำลังอ่านภาพอื่นอยู่ กรุณารอ");
  if (
    typeof WebAssembly === "undefined" ||
    typeof window.Worker === "undefined"
  )
    throw new Error(
      "เบราว์เซอร์นี้ไม่รองรับตัวอ่าน กรุณาใช้ Safari หรือ Chrome รุ่นใหม่",
    );
  running = true;
  logger = options.onProgress;
  const token = generation;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: () => void = () => {};
  const work = async () => {
    const image = await loadImage(source);
    const w = await worker();
    const assertActive = () => {
      if (options.signal.aborted || token !== generation)
        throw new DOMException("ยกเลิกการอ่าน", "AbortError");
    };
    assertActive();
    const passes: {
      extraction: Extraction;
      box: Box;
      scale: number;
      canvas: HTMLCanvasElement;
    }[] = [];
    const read = async (box: Box | undefined, crop: boolean) => {
      const base = draw(image, box, crop ? 1600 : 2400);
      const modes = crop
        ? [
            { dots: false, psm: "6" },
            { dots: true, psm: "6" },
            { dots: false, psm: "11" },
          ]
        : [
            { dots: false, psm: "11" },
            { dots: true, psm: "11" },
          ];
      for (const { dots, psm } of modes) {
        assertActive();
        await w.setParameters({ tessedit_pageseg_mode: psm as PSM });
        options.onProgress(
          0,
          crop
            ? "กำลังอ่านเฉพาะบริเวณโค้ด"
            : dots
              ? "กำลังตรวจตัวพิมพ์แบบจุด"
              : "กำลังค้นหาตำแหน่งโค้ด",
        );
        const prepared = processed(base.canvas, dots, crop);
        const png = await new Promise<Blob>((resolve, reject) =>
          prepared.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error("เตรียมภาพไม่สำเร็จ")),
            "image/png",
          ),
        );
        const pixels = new Uint8Array(await png.arrayBuffer());
        assertActive();
        const { data } = await w.recognize(
          // The v7 browser loader accepts Uint8Array, while its shared types
          // list only Node Buffer for byte inputs. Browser QA verifies this path.
          pixels as unknown as ImageLike,
          {},
          { text: true, blocks: true },
        );
        assertActive();
        const toSource = (box: Box): Box => ({
          x0: base.box.x0 + box.x0 / base.scale,
          y0: base.box.y0 + box.y0 / base.scale,
          x1: base.box.x0 + box.x1 / base.scale,
          y1: base.box.y0 + box.y1 / base.scale,
        });
        const lines = flatten(data).map((l) => ({
          ...l,
          bbox: toSource(l.bbox),
          words: l.words.map((word) => ({
            ...word,
            bbox: toSource(word.bbox),
          })),
        }));
        const extraction = extractPrintedCode(lines, data.text);
        passes.push({
          extraction,
          box: base.box,
          scale: base.scale,
          canvas: base.canvas,
        });
      }
    };
    await read(options.crop, !!options.crop);
    if (!options.crop) {
      const initial = [...passes].sort(
        (a, b) => score(b.extraction) - score(a.extraction),
      )[0];
      const region = codeRegion(initial.extraction);
      if (region) {
        await read(region, true);
      }
    }
    const initial = [...passes].sort(
      (a, b) => score(b.extraction) - score(a.extraction),
    )[0];
    const initialCode = initial.extraction.code;
    // A separate raw-line pass reads the actual printed dots. It never sees
    // the expected year, inspection date or selected Standard.
    if (initialCode?.lines.length && initialCode.confidence.date < 85) {
      const line = initialCode.lines[0];
      const h = line.bbox.y1 - line.bbox.y0;
      const base = draw(
        image,
        {
          x0: line.bbox.x0 - h * 0.3,
          y0: line.bbox.y0 - h * 0.05,
          x1: line.bbox.x1 + h * 0.3,
          y1: line.bbox.y1 + h * 0.05,
        },
        1100,
      );
      const pixels = base.canvas
        .getContext("2d", { willReadFrequently: true })!
        .getImageData(0, 0, base.canvas.width, base.canvas.height);
      const ink = connectDotMatrix(
        pixels.data,
        base.canvas.width,
        base.canvas.height,
      );
      if (ink)
        for (const height of [80, 120]) {
          assertActive();
          options.onProgress(0, "กำลังอ่านตัวพิมพ์แบบจุดทีละบรรทัด");
          const sampled = sampleDotRow(
            ink,
            base.canvas.width,
            base.canvas.height,
            height,
          );
          const canvas = document.createElement("canvas");
          canvas.width = sampled.width;
          canvas.height = sampled.height;
          canvas
            .getContext("2d")!
            .putImageData(
              new ImageData(sampled.data, sampled.width, sampled.height),
              0,
              0,
            );
          await w.setParameters({ tessedit_pageseg_mode: "13" as PSM });
          const png = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (blob) =>
                blob
                  ? resolve(blob)
                  : reject(new Error("เตรียมบรรทัดไม่สำเร็จ")),
              "image/png",
            ),
          );
          const bytes = new Uint8Array(await png.arrayBuffer());
          assertActive();
          const { data } = await w.recognize(
            bytes as unknown as ImageLike,
            {},
            { text: true, blocks: true },
          );
          assertActive();
          const rows = flatten(data);
          if (rows.length !== 1) continue;
          const toSource = (box: Box): Box => ({
            x0:
              base.box.x0 + (box.x0 / sampled.scale - sampled.pad) / base.scale,
            y0:
              base.box.y0 + (box.y0 / sampled.scale - sampled.pad) / base.scale,
            x1:
              base.box.x0 + (box.x1 / sampled.scale - sampled.pad) / base.scale,
            y1:
              base.box.y0 + (box.y1 / sampled.scale - sampled.pad) / base.scale,
          });
          const row = {
            ...rows[0],
            bbox: toSource(rows[0].bbox),
            words: rows[0].words.map((word) => ({
              ...word,
              bbox: toSource(word.bbox),
            })),
          };
          const lines = [row, ...initialCode.lines.slice(1)];
          const extraction = extractPrintedCode(
            lines,
            lines.map((l) => l.text).join("\n"),
          );
          if (!extraction.exp || !extraction.time) continue;
          passes.push({
            extraction,
            box: base.box,
            scale: base.scale,
            canvas: base.canvas,
          });
        }
    }
    assertActive();
    passes.sort((a, b) => score(b.extraction) - score(a.extraction));
    const best = passes[0],
      e = best.extraction;
    if (e.code) {
      e.code.coordinateSpace = "source_pixels";
      e.code.initialText = initial.extraction.rawText;
      e.code.readings = passes
        .filter((p) => p.extraction.exp)
        .map((p) => ({
          date: p.extraction.exp!,
          confidence: p.extraction.code!.confidence.date,
        }));
      const strong = passes.filter(
        (p) => p.extraction.exp && p.extraction.time,
      );
      for (const field of ["exp", "time", "machine"] as const) {
        const observations = strong
          .map((p) => ({
            value: p.extraction[field],
            confidence:
              p.extraction.code!.confidence[field === "exp" ? "date" : field],
          }))
          .filter((x) => x.value && x.confidence >= 60);
        if (new Set(observations.map((x) => x.value)).size > 1) {
          const key = field === "exp" ? "date" : field;
          if (!e.code.ambiguous.includes(key)) e.code.ambiguous.push(key);
          e.notes.push(
            "ผลอ่านหลายรอบไม่ตรงกันในช่อง " +
              (field === "exp"
                ? "วันที่"
                : field === "time"
                  ? "เวลา"
                  : "รหัสเครื่อง"),
          );
        }
      }
    }
    // Legacy product checks also receive uncertainty; a low-confidence code
    // must not become a pass just because a product Standard was selected.
    if (e.code) {
      for (const [field, key] of [
        ["exp", "date"],
        ["machine", "machine"],
      ] as const) {
        if (
          (e.code.confidence[key] < 85 || e.code.ambiguous.includes(key)) &&
          !e.ambiguousFields.includes(field)
        )
          e.ambiguousFields.push(field);
      }
    }
    const region = codeRegion(e);
    const crop = region ? draw(image, region, 1600) : null;
    if (e.code && crop) e.code.crop = crop.box;
    const evidence = crop?.canvas.toDataURL("image/jpeg", 0.94);
    return {
      extraction: e,
      codeImage: evidence,
      model: "Tesseract.js 7.0.0 · eng · OCR ในเครื่อง",
    };
  };
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        abortHandler = () => {
          stopWorker();
          reject(new DOMException("ยกเลิกการอ่าน", "AbortError"));
        };
        options.signal.addEventListener("abort", abortHandler, { once: true });
        if (options.signal.aborted) abortHandler();
        timer = setTimeout(() => {
          stopWorker();
          reject(
            new Error("อ่านภาพเกิน 60 วินาที กรุณาครอบเฉพาะโค้ดแล้วลองใหม่"),
          );
        }, 60000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    options.signal.removeEventListener("abort", abortHandler);
    logger = null;
    running = false;
  }
}
export async function cropPreview(source: string, box: Box): Promise<string> {
  const image = await loadImage(source);
  return draw(image, box, 1600).canvas.toDataURL("image/jpeg", 0.94);
}
export async function rotateSource(source: string): Promise<Blob> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const c = canvas.getContext("2d")!;
  c.translate(canvas.width / 2, canvas.height / 2);
  c.rotate(Math.PI / 2);
  c.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("หมุนภาพไม่สำเร็จ"))),
      "image/jpeg",
      0.96,
    ),
  );
}
