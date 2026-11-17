import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetSentry — Bring your digital world into focus",
  description:
    "Device reports, digital wellbeing and developer tools across web, mobile and desktop. Understand what’s happening. Choose what happens next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
