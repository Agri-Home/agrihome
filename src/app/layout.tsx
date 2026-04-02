import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AgriHome Vision Console",
  description:
    "A hardware-ready agricultural monitoring dashboard with camera capture, image recognition, and monitoring logs."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
