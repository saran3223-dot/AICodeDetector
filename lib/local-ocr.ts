import type { Worker, Page, PSM, ImageLike } from "tesseract.js";
import type { Box, Extraction, OcrLine } from "./types";
import { extractPrintedCode, codeRegion } from "./code-parser";
import { preprocessPixels } from "./ocr-pixels";
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
        const extraction = extractPrintedCode(flatten(data), data.text);
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
        await read(
          {
            x0: initial.box.x0 + region.x0 / initial.scale,
            y0: initial.box.y0 + region.y0 / initial.scale,
            x1: initial.box.x0 + region.x1 / initial.scale,
            y1: initial.box.y0 + region.y1 / initial.scale,
          },
          true,
        );
      }
    }
    assertActive();
    passes.sort((a, b) => score(b.extraction) - score(a.extraction));
    const best = passes[0],
      e = best.extraction;
    if (e.code) {
      e.code.crop = best.box;
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
    const evidence = e.code?.lines.length
      ? best.canvas.toDataURL("image/jpeg", 0.94)
      : undefined;
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
