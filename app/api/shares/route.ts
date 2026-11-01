import {
  ApiError,
  bodyJson,
  bucket,
  cleanupExpired,
  database,
  decodeImage,
  enforceLimit,
  handleError,
  json,
} from "@/lib/server";
export async function POST(req: Request) {
  try {
    const data = (await bodyJson(req)) as Record<string, unknown>;
    const image = decodeImage(data.image);
    const preview = decodeImage(data.preview, 1_000_000);
    await enforceLimit(req, "share");
    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const key = "reports/" + token;
    const now = Date.now();
    const expiresAt = now + 7 * 86400000;
    await cleanupExpired();
    try {
      await bucket().put(key, image.bytes, {
        httpMetadata: { contentType: image.mime },
        customMetadata: { expiresAt: String(expiresAt) },
      });
      await bucket().put(key + ".preview", preview.bytes, {
        httpMetadata: { contentType: preview.mime },
        customMetadata: { expiresAt: String(expiresAt) },
      });
      await database()
        .prepare(
          "INSERT INTO shared_reports (token,object_key,created_at,expires_at) VALUES (?,?,?,?)",
        )
        .bind(token, key, now, expiresAt)
        .run();
    } catch (e) {
      await bucket().delete([key, key + ".preview"]);
      throw e;
    }
    const url = new URL("/share/" + token, req.url).toString();
    return json(
      {
        url,
        previewUrl: url + "?preview=1",
        expiresAt: new Date(expiresAt).toISOString(),
      },
      201,
    );
  } catch (e) {
    return handleError(e);
  }
}
