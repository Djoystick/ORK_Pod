import Link from "next/link";

import { ArchiveCard } from "@/components/archive/archive-card";
import { CategoryOverview } from "@/components/home/category-overview";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { getHomePageData } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { featuredItems, recentItems, categoryOverview } = await getHomePageData();

  return (
    <Container className="space-y-14 pb-16">
      <Reveal>
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#0a1020] to-[#0d1024] p-7 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                ORKPOD MEDIA ARCHIVE
              </p>
              <h1 className="font-display text-4xl leading-tight text-zinc-100 sm:text-6xl">
                Архив стримов и видеозаписей с удобной навигацией по сериям
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Мы пересобираем контент Orkpod в формат каталога: категории, рубрики,
                платформы, детальные страницы записей и быстрый переход к просмотру.
              </p>
            </div>

            <form
              action="/streams"
              method="get"
              className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <label className="block text-sm text-zinc-300" htmlFor="home-search">
                Быстрый вход в архив
              </label>
              <input
                id="home-search"
                name="q"
                type="search"
                placeholder="Например: Next.js, интервью, OBS"
                className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Открыть архив
              </button>
            </form>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.05} className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Discovery</p>
            <h2 className="font-display text-3xl text-zinc-100">Основные категории</h2>
          </div>
          <Link
            href="/streams"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/35 hover:text-white"
          >
            Весь архив
          </Link>
        </div>
        <CategoryOverview blocks={categoryOverview} />
      </Reveal>

      <Reveal delay={0.08} className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Featured</p>
          <h2 className="font-display text-3xl text-zinc-100">Рекомендованные записи</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {featuredItems.map((item) => (
            <ArchiveCard key={item.id} item={item} />
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.12} className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Recent</p>
          <h2 className="font-display text-3xl text-zinc-100">Последние добавления</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recentItems.map((item) => (
            <ArchiveCard key={item.id} item={item} />
          ))}
        </div>
      </Reveal>
    </Container>
  );
}
