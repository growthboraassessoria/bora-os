import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BORA OS", template: "%s · BORA OS" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("bos_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="pt-BR" data-theme={theme} className={`${geist.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
