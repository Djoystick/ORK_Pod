import Link from "next/link";

import { Container } from "@/components/shared/container";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 py-10">
      <Container className="grid gap-4 text-sm text-zinc-400 md:grid-cols-[1fr_auto_auto] md:items-center">
        <p>ORKPOD Archive · каталог стримов и выпусков с современным discovery-подходом.</p>
        <Link href="/streams" className="text-zinc-300 transition hover:text-emerald-100">
          Открыть архив
        </Link>
        <Link href="/about" className="text-zinc-300 transition hover:text-emerald-100">
          О проекте
        </Link>
      </Container>
    </footer>
  );
}
