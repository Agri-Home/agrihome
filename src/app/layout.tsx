import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { PwaProvider } from "@/components/providers/PwaProvider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-app"
});

export const metadata: Metadata = {
  title: "AgriHome Vision Console",
  description:
    "A mobile-first agricultural monitoring app with tray, plant, schedule, and mesh management.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgriHome"
  }
};

export const viewport: Viewport = {
  themeColor: "#eef3e8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.variable}>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
