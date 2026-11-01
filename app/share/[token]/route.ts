import { bucket, database } from "@/lib/server";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9-]{68}$/.test(token))
    return new Response("Not found", { status: 404 });
  const row = await database()
    .prepare("SELECT object_key,expires_at FROM shared_reports WHERE token=?")
    .bind(token)
    .first<{ object_key: string; expires_at: number }>();
  if (!row) return new Response("Not found", { status: 404 });
  if (row.expires_at <= Date.now()) {
    await bucket().delete([row.object_key,row.object_key+".preview"]);
    await database()
      .prepare("DELETE FROM shared_reports WHERE token=?")
      .bind(token)
      .run();
    return new Response("Report expired", {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const object = await bucket().get(row.object_key + (new URL(_req.url).searchParams.get("preview")==="1" ? ".preview" : ""));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
