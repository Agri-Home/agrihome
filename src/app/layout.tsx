import type { Metadata, Viewport } from "next";

import { PwaProvider } from "@/components/providers/PwaProvider";
import { SnackbarProvider } from "@/components/providers/SnackbarProvider";
import "./globals.css";

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
      <body className="font-sans antialiased">
        <PwaProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
