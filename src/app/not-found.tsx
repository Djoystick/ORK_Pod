import Link from "next/link";

import { Container } from "@/components/shared/container";

export default function NotFound() {
  return (
    <Container className="grid min-h-[50vh] place-items-center py-20">
      <div className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">404</p>
        <h1 className="font-display text-4xl text-zinc-100">Запись не найдена</h1>
        <p className="text-zinc-300">
          Похоже, такой страницы нет в текущем архиве. Вернитесь в каталог и выберите
          запись из списка.
        </p>
        <Link
          href="/streams"
          className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          Перейти в архив
        </Link>
      </div>
    </Container>
  );
}
