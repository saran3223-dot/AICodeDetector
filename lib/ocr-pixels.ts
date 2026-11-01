// Image preprocessing only: never substitutes characters, digits or separators.
export function preprocessPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  dots = false,
  radius = 2,
): Uint8ClampedArray {
  const values = new Uint8Array(width * height),
    hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) {
    const j = i * 4;
    const v = Math.round(
      0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2],
    );
    values[i] = v;
    hist[v]++;
  }
  const quantile = (p: number) => {
    let count = 0;
    for (let i = 0; i < 256; i++) {
      count += hist[i];
      if (count >= values.length * p) return i;
    }
    return 255;
  };
  const low = quantile(0.01),
    high = quantile(0.99),
    range = Math.max(30, high - low);
  for (let i = 0; i < values.length; i++)
    values[i] = Math.max(
      0,
      Math.min(255, Math.round(((values[i] - low) * 255) / range)),
    );
  let output = values;
  if (dots) {
    const binary = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++)
      binary[i] = values[i] < 155 ? 0 : 255;
    const horizontal = new Uint8Array(values.length);
    output = new Uint8Array(values.length);
    radius = Math.max(1, Math.min(6, radius));
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let value = 255;
        for (let dx = -radius; dx <= radius; dx++)
          value = Math.min(
            value,
            binary[y * width + Math.max(0, Math.min(width - 1, x + dx))],
          );
        horizontal[y * width + x] = value;
      }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let value = 255;
        for (let dy = -radius; dy <= radius; dy++)
          value = Math.min(
            value,
            horizontal[Math.max(0, Math.min(height - 1, y + dy)) * width + x],
          );
        output[y * width + x] = value;
      }
  }
  const result = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < values.length; i++) {
    result[i * 4] = result[i * 4 + 1] = result[i * 4 + 2] = output[i];
    result[i * 4 + 3] = 255;
  }
  return result;
}
