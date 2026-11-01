import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
export const metadata: Metadata = {
  title: "CodeDetector — ตรวจรหัส มั่นใจทุกผลิตภัณฑ์",
  description:
    "ถ่ายภาพตรวจวันที่และรหัสผลิตภัณฑ์ เทียบ Standard อัตโนมัติ พร้อมรายงานแชร์ LINE",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CodeDetector",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080e1c",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
