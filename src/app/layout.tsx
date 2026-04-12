import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import "./globals.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: {
    default: "ORKPOD Archive",
    template: "%s · ORKPOD Archive",
  },
  description:
    "Современный архив и каталог записей Orkpod: категории, фильтры, серии и страницы выпусков.",
  icons: {
    icon: "/branding/icon.jpg",
    shortcut: "/branding/icon.jpg",
    apple: "/branding/icon.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
