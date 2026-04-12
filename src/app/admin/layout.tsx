import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import Link from "next/link";

import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "Admin",
  description: "Административная зона ORKPOD Archive.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({ children }: PropsWithChildren) {
  return (
    <Container className="space-y-6 pb-16">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Admin</p>
        <h1 className="font-display text-3xl text-zinc-100">ORKPOD Backoffice (V1)</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Временная административная зона контент-платформы: CMS, source registry, ingestion,
          модерация комментариев и базовая community-операционка. Auth/RLS foundation уже
          внедрены, но финальная live hardening-валидация продолжается.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Обзор
          </Link>
          <Link
            href="/admin/new"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Создать запись
          </Link>
          <Link
            href="/admin/content"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Контент
          </Link>
          <Link
            href="/admin/sources"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Источники
          </Link>
          <Link
            href="/admin/imports"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Импорты
          </Link>
          <Link
            href="/admin/moderation"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
          >
            Модерация
          </Link>
        </nav>
      </section>

      {children}
    </Container>
  );
}
