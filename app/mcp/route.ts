import { bodyJson, cleanupExpired, isAdmin, json } from "@/lib/server";
export async function POST(req: Request) {
  let id: unknown = null;
  try {
    const data = (await bodyJson(req, 10000)) as {
      id?: unknown;
      method?: string;
      params?: { name?: string };
    };
    id = data.id ?? null;
    const result = (value: unknown) =>
      json({ jsonrpc: "2.0", id, result: value });
    if (data.method === "server/discover")
      return result({
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {} },
      });
    if (data.method === "initialize")
      return result({
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "CodeDetector maintenance", version: "1.0.0" },
      });
    if (data.method === "notifications/initialized")
      return new Response(null, { status: 204 });
    if (data.method === "tools/list")
      return result({
        tools: [
          {
            name: "cleanup_expired_reports",
            description:
              "ลบเฉพาะภาพรายงานแชร์ที่หมดอายุ 7 วันแล้ว และข้อมูลโควตาหมดอายุ ไม่แตะ Standard หรือประวัติรายงานในมือถือ ใช้ได้เฉพาะผู้ดูแล",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      });
    if (
      data.method === "tools/call" &&
      data.params?.name === "cleanup_expired_reports"
    ) {
      if (!(await isAdmin()))
        return result({
          content: [{ type: "text", text: "เฉพาะผู้ดูแลที่อนุญาตเท่านั้น" }],
          isError: true,
        });
      const deleted = await cleanupExpired();
      return result({
        content: [
          {
            type: "text",
            text: JSON.stringify({ deleted, at: new Date().toISOString() }),
          },
        ],
        isError: false,
      });
    }
    return json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    });
  } catch {
    return json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: "Maintenance request failed" },
    });
  }
}
