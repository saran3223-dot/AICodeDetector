import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Standard } from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function setting(key: string, fallback = ""): string {
  const v =
    (env as unknown as Record<string, unknown>)[key] ?? process.env[key];
  return typeof v === "string" ? v : fallback;
}
export function database(): D1Database {
  if (!env.DB)
    throw new ApiError(503, "ฐานข้อมูล Standard ยังไม่พร้อม กรุณาลองใหม่");
  return env.DB;
}
export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new ApiError(503, "พื้นที่แชร์รายงานยังไม่พร้อม");
  return env.BUCKET;
}
export async function isAdmin() {
  const user = await getChatGPTUser();
  const allowed = setting("ADMIN_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!user && allowed.includes(user.email.toLowerCase());
}
export async function requireAdmin(request?: Request) {
  if (request) checkOrigin(request);
  if (!(await isAdmin()))
    throw new ApiError(403, "เฉพาะผู้ดูแลที่ได้รับอนุญาตเท่านั้น");
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new ApiError(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น");
}
export async function bodyJson(
  req: Request,
  max = 6_000_000,
): Promise<unknown> {
  checkOrigin(req);
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "รองรับ application/json เท่านั้น");
  if (Number(req.headers.get("content-length")) > max)
    throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกินไป");
  if (!req.body) throw new ApiError(400, "ไม่มีข้อมูลคำขอ");
  const reader = req.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    bytes += r.value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกินไป");
    }
    chunks.push(r.value);
  }
  const all = new Uint8Array(bytes);
  let pos = 0;
  for (const chunk of chunks) {
    all.set(chunk, pos);
    pos += chunk.length;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(all));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Object required");
    return parsed;
  } catch {
    throw new ApiError(400, "ข้อมูล JSON ไม่ถูกต้อง");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function handleError(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message }, e.status);
  return json(
    { error: "ระบบขัดข้อง กรุณาลองใหม่ ข้อมูลในเครื่องยังอยู่" },
    500,
  );
}
export async function readStandards(): Promise<Standard[]> {
  const r = await database()
    .prepare("SELECT data FROM standards ORDER BY updated_at DESC")
    .all<{ data: string }>();
  return r.results.map((x) => JSON.parse(x.data) as Standard);
}
export function decodeImage(
  value: unknown,
  max = 4_000_000,
): { bytes: Uint8Array; mime: string } {
  if (typeof value !== "string") throw new ApiError(400, "กรุณาแนบภาพ");
  const m = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!m || m[2].length > Math.ceil((max * 4) / 3) + 4)
    throw new ApiError(400, "รองรับภาพ JPEG, PNG, WebP ขนาดไม่เกิน 4 MB");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  } catch {
    throw new ApiError(400, "ไฟล์ภาพไม่ถูกต้อง");
  }
  const valid =
    m[1] === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : m[1] === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!valid || bytes.length > max)
    throw new ApiError(400, "ข้อมูลภาพไม่ตรงชนิดไฟล์");
  return { bytes, mime: m[1] };
}
export async function enforceLimit(req: Request, kind: "scan" | "share") {
  const db = database();
  const now = Date.now();
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + ":" + Math.floor(now / 86400000)),
  );
  const hashed = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  const daily = Number(
    setting(kind === "scan" ? "DAILY_SCAN_LIMIT" : "DAILY_SHARE_LIMIT", "200"),
  );
  const perMinute = Number(setting("PER_IP_MINUTE_LIMIT", "5"));
  if (
    !Number.isFinite(daily) ||
    daily < 1 ||
    !Number.isFinite(perMinute) ||
    perMinute < 1
  )
    throw new ApiError(503, "ยังไม่ได้กำหนดโควตาการใช้งาน");
  for (const [key, limit, expires] of [
    [
      kind + ":ip:" + hashed + ":" + Math.floor(now / 60000),
      perMinute,
      now + 120000,
    ],
    [kind + ":day:" + Math.floor(now / 86400000), daily, now + 172800000],
  ] as const) {
    const r = await db
      .prepare(
        "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
      )
      .bind(key, expires, limit)
      .first();
    if (!r)
      throw new ApiError(
        429,
        key.includes(":ip:")
          ? "ตรวจถี่เกินไป กรุณารอประมาณหนึ่งนาทีแล้วลองใหม่"
          : "ถึงโควตารายวันของแอปแล้ว กรุณาติดต่อผู้ดูแล",
      );
  }
}
export async function cleanupExpired() {
  const db = database();
  const now = Date.now();
  const rows = await db
    .prepare(
      "SELECT token,object_key FROM shared_reports WHERE expires_at <= ? LIMIT 200",
    )
    .bind(now)
    .all<{ token: string; object_key: string }>();
  if (rows.results.length) {
    await bucket().delete(
      rows.results.flatMap((r) => [r.object_key, r.object_key + ".preview"]),
    );
    await db.batch(
      rows.results.map((r) =>
        db
          .prepare("DELETE FROM shared_reports WHERE token=? AND expires_at<=?")
          .bind(r.token, now),
      ),
    );
  }
  await db
    .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
    .bind(now)
    .run();
  return rows.results.length;
}
