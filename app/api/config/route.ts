import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin, json, setting } from "@/lib/server";
import { env } from "cloudflare:workers";
export async function GET() {
  const user = await getChatGPTUser();
  return json({
    aiReady: false,
    ocrMode: "local",
    lineReady: !!setting("LINE_LIFF_ID"),
    liffId: setting("LINE_LIFF_ID"),
    admin: await isAdmin(),
    signedIn: !!user,
    standardsReady: !!env.DB,
  });
}
