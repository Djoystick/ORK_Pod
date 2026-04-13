import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { getDefaultSocialImageUrl, getSiteMetadataBase } from "@/lib/seo";
import "./globals.css";

export const runtime = "nodejs";

const rootDescription =
  "Современный архив и каталог записей ORKPOD: категории, фильтры, серии и детальные страницы выпусков.";

export const metadata: Metadata = {
  metadataBase: getSiteMetadataBase(),
  title: {
    default: "ORKPOD Archive",
    template: "%s · ORKPOD Archive",
  },
  description: rootDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "ORKPOD Archive",
    locale: "ru_RU",
    title: "ORKPOD Archive",
    description: rootDescription,
    url: "/",
    images: [
      {
        url: getDefaultSocialImageUrl(),
        alt: "ORKPOD Archive",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ORKPOD Archive",
    description: rootDescription,
    images: [getDefaultSocialImageUrl()],
  },
  robots: {
    index: true,
    follow: true,
  },
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
