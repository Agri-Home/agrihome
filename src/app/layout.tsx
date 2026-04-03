import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";

import { AppShell } from "@/components/shell/AppShell";
import { PwaProvider } from "@/components/providers/PwaProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-app",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "AgriHome",
  description: "Tray and plant monitoring.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgriHome"
  }
};

export const viewport: Viewport = {
  themeColor: "#1a3d2e",
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
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <PwaProvider>
          <AppShell>{children}</AppShell>
        </PwaProvider>
      </body>
    </html>
  );
}
