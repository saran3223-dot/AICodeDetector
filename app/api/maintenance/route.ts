import { cleanupExpired, handleError, json, setting } from "@/lib/server";
export async function POST(req: Request) {
  const token = setting("MAINTENANCE_TOKEN");
  if (!token || req.headers.get("authorization") !== "Bearer " + token)
    return json({ error: "Unauthorized" }, 401);
  try {
    return json({
      deleted: await cleanupExpired(),
      at: new Date().toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}
