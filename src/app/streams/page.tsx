import { Suspense } from "react";

import { ArchiveExplorer } from "@/app/streams/archive-explorer";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/motion/reveal";
import { getArchivePageData } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Архив стримов",
  description: "Каталог записей с поиском, фильтрацией и сортировкой по дате.",
};

export default async function StreamsPage() {
  const { initialItems, filterOptions } = await getArchivePageData();

  return (
    <Container className="space-y-8 pb-16">
      <Reveal>
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Архив</p>
          <h1 className="font-display text-4xl leading-tight text-zinc-100 sm:text-5xl">
            Каталог записей
          </h1>
          <p className="max-w-3xl text-zinc-300">
            Единая лента выпусков Orkpod с быстрым поиском по темам, фильтрами по
            категориям/сериям/платформам и сортировкой по дате публикации.
          </p>
        </section>
      </Reveal>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-zinc-300">
            Загрузка архива...
          </div>
        }
      >
        <ArchiveExplorer initialItems={initialItems} filterOptions={filterOptions} />
      </Suspense>
    </Container>
  );
}
