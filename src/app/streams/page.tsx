import type { Metadata } from "next";
import { Suspense } from "react";

import { ArchiveExplorer } from "@/app/streams/archive-explorer";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import {
  getDefaultSocialImageUrl,
  pickMetaDescription,
  toAbsoluteSiteUrl,
} from "@/lib/seo";
import { getArchivePageData } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

type StreamsPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    series?: string;
    platform?: string;
    sort?: string;
  }>;
};

function hasNonDefaultArchiveFilters(params: {
  q?: string;
  category?: string;
  series?: string;
  platform?: string;
  sort?: string;
}) {
  return Boolean(
    (params.q ?? "").trim() ||
      (params.category && params.category !== "all") ||
      (params.series && params.series !== "all") ||
      (params.platform && params.platform !== "all") ||
      (params.sort && params.sort !== "newest"),
  );
}

export async function generateMetadata({
  searchParams,
}: StreamsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const isFilteredView = hasNonDefaultArchiveFilters(params);
  const query = (params.q ?? "").trim();

  const title = query ? `Архив: ${query}` : "Архив стримов";
  const description = pickMetaDescription(
    query
      ? `Поиск по архиву ORKPOD по запросу «${query}» с фильтрацией по категориям, сериям и платформам.`
      : "Каталог записей ORKPOD с поиском, фильтрацией и сортировкой по дате публикации.",
  );

  return {
    title,
    description,
    alternates: {
      canonical: "/streams",
    },
    robots: isFilteredView
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      type: "website",
      title,
      description,
      url: "/streams",
      images: [
        {
          url: getDefaultSocialImageUrl(),
          alt: "Архив ORKPOD",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [getDefaultSocialImageUrl()],
    },
  };
}

const archiveStructuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Архив стримов ORKPOD",
  url: toAbsoluteSiteUrl("/streams"),
  inLanguage: "ru-RU",
  description: pickMetaDescription(
    "Каталог записей ORKPOD с фильтрами по категориям, сериям и платформам.",
  ),
  isPartOf: {
    "@type": "WebSite",
    name: "ORKPOD Archive",
    url: toAbsoluteSiteUrl("/"),
  },
};

export default async function StreamsPage() {
  const { initialItems, filterOptions } = await getArchivePageData();

  return (
    <Container className="space-y-8 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(archiveStructuredData) }}
      />

      <Reveal>
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Архив</p>
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
