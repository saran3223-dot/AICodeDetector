import type { Report } from "./types";
import { outcomeLabel } from "./types";
export async function imageFromFile(file: File, rotation = 0): Promise<string> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("กรุณาเลือกภาพไม่เกิน 20 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return compress(image, rotation);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("กรุณา")) throw e;
    throw new Error(
      "เปิดภาพไม่ได้ กรุณาเลือก JPEG, PNG หรือ WebP (หากเป็น HEIC ให้แปลงเป็น JPEG)",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function compress(image: HTMLImageElement, rotation = 0) {
  const scale = Math.min(
    1,
    2048 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const w = Math.round(image.naturalWidth * scale),
    h = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = rotation % 180 ? h : w;
  canvas.height = rotation % 180 ? w : h;
  const c = canvas.getContext("2d")!;
  c.translate(canvas.width / 2, canvas.height / 2);
  c.rotate((rotation * Math.PI) / 180);
  c.drawImage(image, -w / 2, -h / 2, w, h);
  const result = canvas.toDataURL("image/jpeg", 0.87);
  if (result.length > 5_300_000)
    throw new Error("กรุณาครอบภาพให้เล็กลง ไฟล์ยังใหญ่เกิน 4 MB");
  return result;
}
export async function rotateImage(src: string) {
  return compress(await loadImage(src), 90);
}
export async function renderReport(report: Report): Promise<Blob> {
  await document.fonts.ready;
  await document.fonts.load('500 24px "Noto Sans Thai"');
  const image = await loadImage(report.image);
  const canvas = document.createElement("canvas");
  const width = 1080;
  const c = canvas.getContext("2d")!;
  canvas.width = width;
  canvas.height = 7000;
  let y = 72;
  c.fillStyle = "#f4f7fc";
  c.fillRect(0, 0, width, 7000);
  c.fillStyle = "#0b1730";
  c.fillRect(0, 0, width, 230);
  c.fillStyle = "#73aaff";
  c.font = '600 21px "Noto Sans Thai"';
  c.fillText("CODEDETECTOR  /  INSPECTION REPORT", 56, y);
  y += 61;
  c.fillStyle = "#ffffff";
  c.font = '700 36px "Noto Sans Thai"';
  c.fillText("รายงานตรวจสอบผลิตภัณฑ์", 56, y);
  y += 42;
  c.font = '400 20px "Noto Sans Thai"';
  c.fillStyle = "#bdcce4";
  c.fillText(
    new Date(report.createdAt).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
    }) +
      " · " +
      report.id,
    56,
    y,
  );
  y = 278;
  const text = (
    value: string,
    x: number,
    maxWidth: number,
    font = 24,
    color = "#192e50",
    line = 38,
  ) => {
    c.font = "500 " + font + 'px "Noto Sans Thai"';
    c.fillStyle = color;
    const lines: string[] = [];
    let row = "";
    for (const char of Array.from(value)) {
      if (char === "\n") {
        lines.push(row);
        row = "";
        continue;
      }
      if (c.measureText(row + char).width > maxWidth && row) {
        lines.push(row);
        row = char;
      } else row += char;
    }
    if (row) lines.push(row);
    for (const l of lines) {
      c.fillText(l, x, y);
      y += line;
    }
  };
  const color =
    report.status === "pass"
      ? "#137c53"
      : report.status === "fail"
        ? "#bb314e"
        : "#9a6500";
  text(outcomeLabel[report.status], 56, 968, 34, color, 46);
  text(report.productName, 56, 968, 28);
  text(
    "Standard: " +
      (report.standard
        ? report.standard.name + " · v" + report.standard.revision
        : "ยังไม่ระบุ"),
    56,
    968,
    20,
    "#62718a",
    32,
  );
  const imgHeight = Math.min(
    540,
    (image.naturalHeight * 968) / image.naturalWidth,
  );
  const imgWidth = (imgHeight * image.naturalWidth) / image.naturalHeight;
  c.fillStyle = "#e4eaf4";
  c.fillRect(56, y + 16, 968, imgHeight + 20);
  c.drawImage(image, 56 + (968 - imgWidth) / 2, y + 26, imgWidth, imgHeight);
  y += imgHeight + 80;
  if (report.codeImage) {
    const code = await loadImage(report.codeImage);
    const h = Math.min(300, (code.naturalHeight * 968) / code.naturalWidth);
    const w = (h * code.naturalWidth) / code.naturalHeight;
    text("ภาพบริเวณโค้ดที่ใช้ตรวจ", 56, 968, 22);
    c.drawImage(code, 56 + (968 - w) / 2, y + 10, w, h);
    y += h + 60;
  }
  if (report.extraction.code) {
    const code = report.extraction.code;
    text(
      "รูปแบบที่พบ: " +
        (code.layout ? code.layout + " บรรทัด" : "ยืนยันไม่ได้"),
      56,
      968,
      22,
    );
    text("รหัสเครื่อง: ตรวจเฉพาะการมีรหัส", 56, 968, 22);
    text(
      "คะแนน OCR วันที่ " +
        Math.round(code.confidence.date) +
        " / เวลา " +
        Math.round(code.confidence.time) +
        " / รหัส " +
        Math.round(code.confidence.machine),
      56,
      968,
      20,
      "#62718a",
      30,
    );
    text(
      "เกณฑ์แต่ละช่อง 85 · คะแนนไม่ใช่เปอร์เซ็นต์ความถูกต้อง",
      56,
      968,
      20,
      "#62718a",
      30,
    );
    y += 20;
  }
  text("ผลตรวจรายข้อ", 56, 968, 28);
  for (const check of report.checks) {
    y += 15;
    c.fillStyle = "#d9e1ee";
    c.fillRect(56, y - 10, 968, 1);
    y += 26;
    const cc =
      check.status === "pass"
        ? "#137c53"
        : check.status === "fail"
          ? "#bb314e"
          : "#9a6500";
    text(
      (check.status === "pass"
        ? "ผ่าน"
        : check.status === "fail"
          ? "ไม่ผ่าน"
          : "ตรวจซ้ำ") +
        " · " +
        check.field,
      56,
      968,
      24,
      cc,
    );
    text("ค่าที่พบ: " + check.observed, 56, 968, 22);
    text(
      "มาตรฐาน: " +
        (check.expected.length > 450
          ? check.expected.slice(0, 450) + "… (รายการเต็มในแอป)"
          : check.expected),
      56,
      968,
      22,
    );
    text(check.reason, 56, 968, 20, "#62718a", 32);
  }
  y += 30;
  text("ข้อความที่อ่านจากภาพ", 56, 968, 24);
  const raw = report.extraction.rawText;
  text(
    raw.length > 2000
      ? raw.slice(0, 2000) + "\n… ข้อความฉบับเต็มอยู่ในแอปและไฟล์สำรอง"
      : raw || "ไม่พบข้อความ",
    56,
    968,
    20,
    "#62718a",
    30,
  );
  if (report.corrections.length) {
    y += 14;
    text(
      "มีการแก้ไขผลอ่านโดยผู้ใช้ " + report.corrections.length + " ครั้ง",
      56,
      968,
      20,
      "#9a6500",
      32,
    );
  }
  y += 24;
  text("ตัวอ่าน: " + report.model, 56, 968, 18, "#62718a", 28);
  text(
    "ผลตรวจตาม Standard ที่ระบุ ณ เวลาตรวจ · เก็บภาพต้นฉบับเพื่อการทวนสอบ",
    56,
    968,
    18,
    "#62718a",
    28,
  );
  const final = document.createElement("canvas");
  final.width = width;
  if (y + 50 > 7000)
    throw new Error(
      "รายงานยาวเกินขนาดภาพ กรุณาส่งออกไฟล์สำรองเพื่อเก็บข้อมูลครบถ้วน",
    );
  final.height = y + 50;
  final.getContext("2d")!.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) =>
    final.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("สร้างภาพรายงานไม่สำเร็จ"))),
      "image/png",
    ),
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
export async function previewDataUrl(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = Math.round(
      (image.naturalHeight * 600) / image.naturalWidth,
    );
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
