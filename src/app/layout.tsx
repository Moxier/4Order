import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "4Order",
    template: "%s | 4Order",
  },
  description: "ระบบสั่งอาหารสำหรับร้านอาหารขนาดเล็ก",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#146c43",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
