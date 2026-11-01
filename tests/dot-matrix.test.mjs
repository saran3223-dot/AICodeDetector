import test from "node:test";
import assert from "node:assert/strict";
import { connectDotMatrix, sampleDotRow } from "../lib/dot-matrix.ts";
function image(w, h) {
  const a = new Uint8ClampedArray(w * h * 4);
  a.fill(255);
  return a;
}
test("blank or ordinary connected ink is not classified as dot-matrix", () => {
  const a = image(120, 60);
  assert.equal(connectDotMatrix(a, 120, 60), null);
  for (let y = 10; y < 50; y++)
    for (let x = 10; x < 110; x++) {
      const n = (y * 120 + x) * 4;
      a[n] = a[n + 1] = a[n + 2] = 0;
    }
  assert.equal(connectDotMatrix(a, 120, 60), null);
});
test("dot connections preserve a large separator gap and image dimensions", () => {
  const w = 150,
    h = 80,
    a = image(w, h);
  for (let col = 0; col < 6; col++)
    for (const cy of [20, 30, 60])
      for (let y = cy - 2; y <= cy + 2; y++)
        for (let x = 10 + col * 22 - 2; x <= 10 + col * 22 + 2; x++) {
          const n = (y * w + x) * 4;
          a[n] = a[n + 1] = a[n + 2] = 0;
        }
  const result = connectDotMatrix(a, w, h);
  assert.ok(result);
  assert.equal(result.length, w * h);
  assert.equal(
    result[45 * w + 10],
    255,
    "do not connect two distant colon-like ink groups",
  );
  assert.equal(result[20 * w + 21], 255, "do not fill character spacing");
  const sampled = sampleDotRow(result, w, h, 80);
  assert.equal(sampled.height, 80);
  assert.equal(sampled.data.length, sampled.width * sampled.height * 4);
  assert.equal(sampled.data[0], 255, "white evidence border is retained");
});
test("downsampling retains uncertainty as gray pixels instead of inventing a glyph", () => {
  const ink = new Uint8Array(13 * 13);
  ink.fill(255);
  ink[6 * 13 + 6] = 0;
  const result = sampleDotRow(ink, 13, 13, 20);
  assert.ok(result.data.some((v, i) => i % 4 !== 3 && v > 0 && v < 255));
});
