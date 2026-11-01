# Validation — CodeDetector 1.1 — 1 November 2026

## Automated checks

- npm test: **53 passed**. Existing 24 product/date rules retained; new Code and backup cases cover:
  - Automatic preset selection, real calendar dates, year +1, Bangkok New Year boundary.
  - 24-hour range, missing/excess seconds, wrong separators, incorrect line count.
  - Required whitespace and machine presence, repeated whitespace allowed.
  - Confidence per field, ambiguity, no code, proven failure taking precedence.
  - Explicit human confirmation, invalid manual transcription, immutable Standard snapshot.
  - Tall packaging text not merged into Code, no inserted spaces between touching fragments.
  - Legacy report import without OCR metadata; new metadata/image/audit roundtrip; malformed backups rejected.
- TypeScript: passed.
- Production build: passed. Final publication uses the Sites build/package helper.
- POST /api/analyze: HTTP **410**, before request/image/key processing. No OpenAI call was used in these tests.

## Actual OCR of supplied photographs

These are **real Tesseract.js 7.0.0 browser results**, not mocked extraction responses. English model and all Worker/core assets are self-hosted. Desktop Chromium; not a physical handset benchmark.

| Supplied file | Full photograph | Explicit crop from original |
| --- | --- | --- |
| IMG_1703 (1).jpg | Read 29/09/2021, 16:00:32, BB. Field scores 54/85/74. **Review**; wrong-looking year was not treated as a proven failure because the date was uncertain. | No complete date/time candidate. **Review**. |
| IMG_1661.JPG | No complete Code candidate. **Review**. | No complete Code candidate. **Review**. |
| IMG_1662 (1).JPG | **20102027 12:47 BB**, scores **96/96/96**, **pass** with one-line preset and 2027 expected year. | Read date 20102027 and time 12:47; no reliable machine. Scores 66/66/0. **Review**. |

- Full-image pipeline includes locating Code and reading its original-image region automatically.
- Explicit test crop rectangles (original pixel coordinates): image 1 (1970,620)–(3020,1020); image 2 (140,835)–(540,1005); image 3 (380,390)–(800,470). Cropping is not guaranteed to improve OCR, especially when background/logo is included.
- Local Node experiments with individual dot-matrix rows could read 23/09/2027 and 20/10/2027, but scores were below 85. These experiments do not establish automatic approval in the app.
- Visual comparison: time in image 1 is 16:00:32 and BB; date glyphs are ambiguous. Image 2 shows 20/10/2027, 13:07:13, and an ambiguous code/no clear separating space. Image 3 matches the successful full-image result.
- The two dot-matrix photos require retaking/adjusting crop or explicitly verifying transcription against the original. No guessed factory machine whitelist is used.
- Six consecutive browser OCR operations created **one reusable Worker**.
- OCR request capture: **zero /api/analyze or api.openai.com requests**. Worker, core and English data use the same website origin; local blob URLs hold the images.
- Blank image: **review**, never pass.
- Original photos and QA image artifacts remain in ignored local output directories; they are not published as application assets.

## Browser flows and persistence

- Real photo upload → automatic Standard → real OCR → saved pass report: passed for image 3.
- PNG download generated and visually inspected: full evidence photo, Code image, date, time, machine policy, expected year, per-rule result/reason and confidence are legible.
- Human confirmation through UI created a new report ID and audit entry; original report and original Extraction were preserved exactly.
- Pointer crop UI selected a region using original-image coordinates; cancel OCR returned to ready state with the image intact.
- Rotate-image control: passed smoke test.
- IndexedDB reports survived page reload.
- Backup validation + deletion/reimport in the isolated QA browser: **4 reports restored, semantically identical**, including Code metadata and corrections. JSON property ordering is not treated as data loss.
- Internet disabled after loading OCR/Standard: another local scan completed and passed. This is not a promise of cold-start offline installation; there is no service worker.
- 60-second timeout branch: passed using an **accelerated browser clock**, followed by successful retry on a blank image (review); zero page errors in the final timeout/retry test. This is timer simulation, not a physical slow-device endurance test.
- Chromium widths **360/390/430px**: document width matched viewport, no horizontal overflow. Screenshots inspected.
- LIFF recipient picker and delivery to a real LINE friend/group: **not tested**, LINE_LIFF_ID is still not configured.
- Physical iPhone Safari, Android camera, memory pressure and LINE in-app browser: **not tested**. Desktop viewport emulation does not establish these results.

## Compatibility and publication

- Standard presets use fixed IDs and INSERT OR IGNORE in the central database; repeated reads cannot duplicate them or overwrite disabled presets.
- Existing product Standards remain selectable; their calendar/shelf-life/machine rules are retained. Local OCR focuses on the two Code formats; other product fields may need explicit transcription.
- Reports retain their original Standard snapshots. Editing Standards does not recalculate old reports.
- API key files and server secrets were neither deleted nor revoked. API credit exhaustion is no longer a dependency of Code OCR.
- Existing D1/R2 sharing, seven-day links, hourly cleanup and public Site audience are retained.
- v1 tests of authenticated writes, R2 share-image readback, SVG rejection and expiration cleanup are prior evidence; these unchanged paths were not all repeated in 1.1.

