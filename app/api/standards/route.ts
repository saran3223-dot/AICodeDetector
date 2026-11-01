import { standardInput } from "@/lib/validation";
import {
  bodyJson,
  database,
  handleError,
  json,
  readStandards,
  requireAdmin,
  ApiError,
} from "@/lib/server";
import { normalize } from "@/lib/inspection";
import type { Standard } from "@/lib/types";
export async function GET() {
  try {
    return json({ standards: await readStandards() });
  } catch (e) {
    return handleError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const parsed = standardInput.safeParse(await bodyJson(req, 25000));
    if (!parsed.success)
      throw new ApiError(
        400,
        parsed.error.issues.map((x) => x.message).join(" · "),
      );
    const input = parsed.data;
    const current = await readStandards();
    if (
      current.some(
        (s) => s.id !== input.id && normalize(s.sku) === normalize(input.sku),
      )
    )
      throw new ApiError(
        409,
        "SKU นี้มี Standard อยู่แล้ว กรุณาแก้ไขรายการเดิม",
      );
    const old = input.id ? current.find((s) => s.id === input.id) : null;
    if (input.id && !old) throw new ApiError(404, "ไม่พบ Standard");
    if (old && old.revision !== input.revision)
      throw new ApiError(
        409,
        "มีผู้แก้ไข Standard นี้แล้ว กรุณาโหลดข้อมูลใหม่",
      );
    const standard: Standard = {
      ...input,
      id: input.id || crypto.randomUUID(),
      revision: (old?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const db = database();
    const result = old
      ? await db
          .prepare(
            "UPDATE standards SET data=?,revision=?,updated_at=? WHERE id=? AND revision=? RETURNING id",
          )
          .bind(
            JSON.stringify(standard),
            standard.revision,
            standard.updatedAt,
            standard.id,
            old.revision,
          )
          .first()
      : await db
          .prepare(
            "INSERT INTO standards (id,data,revision,updated_at) VALUES (?,?,?,?) RETURNING id",
          )
          .bind(
            standard.id,
            JSON.stringify(standard),
            standard.revision,
            standard.updatedAt,
          )
          .first();
    if (!result) throw new ApiError(409, "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่");
    return json({ standard }, old ? 200 : 201);
  } catch (e) {
    return handleError(e);
  }
}
