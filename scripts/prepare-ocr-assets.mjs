import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../public/ocr/", import.meta.url);
await mkdir(root, { recursive: true });
await mkdir(new URL("core/", root), { recursive: true });
await mkdir(new URL("lang/", root), { recursive: true });
await copyFile(
  new URL("../node_modules/tesseract.js/dist/worker.min.js", import.meta.url),
  new URL("worker.min.js", root),
);
for (const name of await readdir(
  new URL("../node_modules/tesseract.js-core/", import.meta.url),
))
  if (name.endsWith(".wasm.js") || name.endsWith(".wasm"))
    await copyFile(
      new URL("../node_modules/tesseract.js-core/" + name, import.meta.url),
      new URL("core/" + name, root),
    );
await copyFile(
  new URL("../node_modules/tesseract.js/LICENSE.md", import.meta.url),
  new URL("LICENSE-tesseract.txt", root),
);
await copyFile(
  new URL("../node_modules/tesseract.js-core/LICENSE", import.meta.url),
  new URL("LICENSE-core.txt", root),
);
const url =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";
const target = new URL("lang/eng.traineddata.gz", root);
let model;
try {
  model = await readFile(target);
} catch {
  const r = await fetch(url);
  if (!r.ok) throw Error("Model download failed: " + r.status);
  model = Buffer.from(await r.arrayBuffer());
  await writeFile(target, model);
}
const hash = createHash("sha256").update(model).digest("hex");
let prior;
try {
  prior = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
} catch {}
if (prior?.modelSha256 && prior.modelSha256 !== hash)
  throw Error("OCR model checksum mismatch");
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      engine: "tesseract.js",
      version: "7.0.0",
      language: "eng",
      modelSource: url,
      modelSha256: hash,
    },
    null,
    2,
  ) + "\n",
);
console.log("Self-hosted OCR assets ready; model bytes " + model.length);
