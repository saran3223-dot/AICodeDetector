import { preprocessPixels } from "./ocr-pixels.ts";

// Connect nearby ink components, not characters. No date, year or Standard is
// available here: the operation only draws short bridges between visible dots.
export function connectDotMatrix(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array | null {
  const gray = preprocessPixels(rgba, width, height);
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < binary.length; i++)
    binary[i] = gray[i * 4] < 145 ? 0 : 255;
  const seen = new Uint8Array(binary.length);
  const queue = new Int32Array(binary.length);
  const components: {
    points: number[];
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }[] = [];
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] || seen[i]) continue;
    let begin = 0,
      end = 1,
      area = 0,
      x0 = width,
      x1 = 0,
      y0 = height,
      y1 = 0;
    queue[0] = i;
    seen[i] = 1;
    const points: number[] = [];
    while (begin < end) {
      const n = queue[begin++],
        x = n % width,
        y = Math.floor(n / width);
      area++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      let edge = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) {
            edge = true;
            continue;
          }
          const j = yy * width + xx;
          if (binary[j]) edge = true;
          else if (!seen[j]) {
            seen[j] = 1;
            queue[end++] = j;
          }
        }
      if (edge && points.length < 1024) points.push(n);
    }
    if (area >= 8 && area < binary.length / 4)
      components.push({ points, x0, x1, y0, y1 });
    if (components.length > 500) return null;
  }
  const sizes = components
    .map((c) => c.y1 - c.y0 + 1)
    .filter((h) => h >= 3 && h < height / 4)
    .sort((a, b) => a - b);
  if (sizes.length < 12) return null;
  const diameter = sizes[Math.floor(sizes.length / 2)];
  const radius = Math.max(1, Math.round(diameter * 0.35));
  const output = Uint8Array.from(binary);
  for (let i = 0; i < components.length; i++)
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i],
        b = components[j];
      const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1),
        dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
      if (dx * dx + dy * dy > diameter * diameter) continue;
      if (
        Math.abs(a.y0 + a.y1 - b.y0 - b.y1) < diameter * 1.1 &&
        dx > diameter * 0.35
      )
        continue;
      let distance = Infinity,
        from = 0,
        to = 0;
      for (const p of a.points)
        for (const q of b.points) {
          const d =
            ((p % width) - (q % width)) ** 2 +
            (Math.floor(p / width) - Math.floor(q / width)) ** 2;
          if (d < distance) {
            distance = d;
            from = p;
            to = q;
          }
        }
      if (distance > diameter * diameter || !Number.isFinite(distance))
        continue;
      const steps = Math.max(1, Math.ceil(Math.sqrt(distance)));
      for (let t = 0; t <= steps; t++) {
        const x = Math.round(
          (from % width) + (((to % width) - (from % width)) * t) / steps,
        );
        const y = Math.round(
          Math.floor(from / width) +
            ((Math.floor(to / width) - Math.floor(from / width)) * t) / steps,
        );
        for (
          let yy = Math.max(0, y - radius);
          yy <= Math.min(height - 1, y + radius);
          yy++
        )
          for (
            let xx = Math.max(0, x - radius);
            xx <= Math.min(width - 1, x + radius);
            xx++
          )
            if ((xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2)
              output[yy * width + xx] = 0;
      }
    }
  return output;
}

// Area averaging is deterministic in Node and browsers, including small mobile
// canvases. Downsample connected strokes before the OCR line recognizer.
export function sampleDotRow(
  ink: Uint8Array,
  width: number,
  height: number,
  targetHeight = 80,
) {
  const pad = Math.max(12, Math.round(height * 0.1));
  const scale = targetHeight / (height + pad * 2);
  const targetWidth = Math.max(1, Math.round((width + pad * 2) * scale));
  const data = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++)
    for (let x = 0; x < targetWidth; x++) {
      const sx0 = x / scale - pad,
        sx1 = (x + 1) / scale - pad,
        sy0 = y / scale - pad,
        sy1 = (y + 1) / scale - pad;
      let sum = 0,
        weight = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++)
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
          const area =
            Math.max(0, Math.min(sx1, xx + 1) - Math.max(sx0, xx)) *
            Math.max(0, Math.min(sy1, yy + 1) - Math.max(sy0, yy));
          sum +=
            (xx < 0 || yy < 0 || xx >= width || yy >= height
              ? 255
              : ink[yy * width + xx]) * area;
          weight += area;
        }
      const value = Math.round(sum / weight),
        i = (y * targetWidth + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  return { data, width: targetWidth, height: targetHeight, scale, pad };
}
