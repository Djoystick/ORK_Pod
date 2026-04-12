import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArchiveCard } from "@/components/archive/archive-card";
import { CategoryOverview } from "@/components/home/category-overview";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import {
  getDefaultSocialImageUrl,
  pickMetaDescription,
  toAbsoluteSiteUrl,
} from "@/lib/seo";
import { getHomePageData } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

const homeDescription = pickMetaDescription(
  "Архив стримов и видеозаписей ORKPOD с фильтрами по категориям, сериям и платформам.",
);

export const metadata: Metadata = {
  title: "Главная",
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: "ORKPOD Archive",
    description: homeDescription,
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
    description: homeDescription,
    images: [getDefaultSocialImageUrl()],
  },
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ORKPOD Archive",
  url: toAbsoluteSiteUrl("/"),
  inLanguage: "ru-RU",
  description: homeDescription,
  potentialAction: {
    "@type": "SearchAction",
    target: `${toAbsoluteSiteUrl("/streams")}?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default async function HomePage() {
  const { featuredItems, recentItems, categoryOverview } = await getHomePageData();

  return (
    <Container className="space-y-14 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
      />

      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-[#0a1711] p-7 sm:p-10">
          <Image
            src="/branding/background.webp"
            alt="ORKPOD hero background"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(2,8,5,0.84)_12%,rgba(2,10,7,0.58)_45%,rgba(1,6,4,0.9)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(52,211,153,0.22),transparent_45%)]" />

          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                ORKPOD MEDIA ARCHIVE
              </p>
              <h1 className="font-display text-4xl leading-tight text-zinc-100 sm:text-6xl">
                Архив стримов и видеозаписей с удобной навигацией по сериям
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-200 sm:text-lg">
                Мы пересобираем контент Orkpod в формат каталога: категории, рубрики,
                платформы, детальные страницы записей и быстрый переход к просмотру.
              </p>
            </div>

            <form
              action="/streams"
              method="get"
              className="space-y-3 rounded-2xl border border-emerald-200/25 bg-black/35 p-4 backdrop-blur-sm"
            >
              <label className="block text-sm text-zinc-200" htmlFor="home-search">
                Быстрый вход в архив
              </label>
              <input
                id="home-search"
                name="q"
                type="search"
                placeholder="Например: Next.js, интервью, OBS"
                className="h-12 w-full rounded-xl border border-white/15 bg-black/35 px-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-emerald-300 text-sm font-semibold text-[#062515] transition hover:bg-emerald-200"
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
            className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-300/60 hover:text-emerald-50"
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
