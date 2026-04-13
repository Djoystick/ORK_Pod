import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArchiveCard } from "@/components/archive/archive-card";
import { CategoryOverview } from "@/components/home/category-overview";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { getDefaultSocialImageUrl, pickMetaDescription, toAbsoluteSiteUrl } from "@/lib/seo";
import { getHomePageData } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

const homeDescription = pickMetaDescription(
  "Современный каталог стримов и видео ORKPOD: быстрый поиск, рубрики, подборки и удобный вход в архив.",
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

function pickPlatformLinks(
  recentItems: Awaited<ReturnType<typeof getHomePageData>>["recentItems"],
) {
  const unique = new Map<string, { slug: string; title: string }>();
  for (const item of recentItems) {
    if (!unique.has(item.platform.slug)) {
      unique.set(item.platform.slug, {
        slug: item.platform.slug,
        title: item.platform.title,
      });
    }
  }
  return Array.from(unique.values()).slice(0, 5);
}

export default async function HomePage() {
  const { featuredItems, recentItems, categoryOverview } = await getHomePageData();
  const platformLinks = pickPlatformLinks(recentItems);
  const totalItems = categoryOverview.reduce((sum, block) => sum + block.itemCount, 0);
  const topCategoryLinks = categoryOverview.slice(0, 7);

  return (
    <Container className="space-y-16 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
      />

      <Reveal>
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#0a1611] p-6 sm:p-9">
          <Image
            src="/branding/background.webp"
            alt="ORKPOD hero background"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1240px"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(2,8,5,0.92)_8%,rgba(2,10,7,0.68)_44%,rgba(2,8,5,0.88)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(52,211,153,0.26),transparent_42%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/35 bg-emerald-300/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-100">
                  ORKPOD Discovery
                </span>
                <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-zinc-200">
                  Каталог в живом обновлении
                </span>
              </div>

              <h1 className="font-display text-4xl leading-tight text-zinc-50 sm:text-6xl">
                Находите нужные выпуски быстро, как в современном медиа-каталоге
              </h1>

              <p className="max-w-3xl text-base leading-7 text-zinc-200 sm:text-lg">
                Домашняя страница собрана вокруг discovery-потока: быстрый вход в архив, тематические
                направления, подборки и свежие добавления без лишней навигационной нагрузки.
              </p>

              <form
                action="/streams"
                method="get"
                className="grid gap-3 rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-sm sm:grid-cols-[1fr_auto]"
              >
                <input
                  name="q"
                  type="search"
                  placeholder="Поиск по архиву: Next.js, интервью, OBS..."
                  className="h-12 rounded-xl border border-white/15 bg-black/35 px-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
                />
                <button
                  type="submit"
                  className="h-12 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#062515] transition hover:bg-emerald-200"
                >
                  Искать в архиве
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {topCategoryLinks.map((entry) => (
                  <Link
                    key={entry.category.id}
                    href={`/streams?category=${entry.category.slug}`}
                    className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
                  >
                    {entry.category.title}
                  </Link>
                ))}
              </div>
            </div>

            <aside className="space-y-4 rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-sm">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <article className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Записей</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">{totalItems}</p>
                </article>
                <article className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Категорий</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">{categoryOverview.length}</p>
                </article>
                <article className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Витрина</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">Live</p>
                </article>
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">По платформам</p>
                <div className="flex flex-wrap gap-2">
                  {platformLinks.map((platform) => (
                    <Link
                      key={platform.slug}
                      href={`/streams?platform=${platform.slug}`}
                      className="rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-1 text-xs text-emerald-100 transition hover:border-emerald-300/60"
                    >
                      {platform.title}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href="/streams"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] text-sm font-medium text-zinc-100 transition hover:border-emerald-300/50 hover:text-emerald-100"
              >
                Открыть полный каталог
              </Link>
            </aside>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.04} className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Категории</p>
            <h2 className="font-display text-3xl text-zinc-100">Исследуйте по направлениям</h2>
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
          <h2 className="font-display text-3xl text-zinc-100">Рекомендуемые подборки</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          {featuredItems[0] ? <ArchiveCard item={featuredItems[0]} /> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {featuredItems.slice(1).map((item) => (
              <ArchiveCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12} className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Recent</p>
            <h2 className="font-display text-3xl text-zinc-100">Свежие поступления в архив</h2>
          </div>
          <Link
            href="/streams?sort=newest"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
          >
            Смотреть все новые
          </Link>
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
