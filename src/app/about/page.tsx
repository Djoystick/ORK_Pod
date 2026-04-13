import type { Metadata } from "next";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { getDefaultSocialImageUrl, pickMetaDescription, toAbsoluteSiteUrl } from "@/lib/seo";

const aboutDescription = pickMetaDescription(
  "Что такое ORKPOD Archive, как устроен каталог и какие принципы лежат в основе системы архивирования.",
);

export const metadata: Metadata = {
  title: "О проекте",
  description: aboutDescription,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    title: "О проекте ORKPOD Archive",
    description: aboutDescription,
    url: "/about",
    images: [
      {
        url: getDefaultSocialImageUrl(),
        alt: "ORKPOD Archive — о проекте",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "О проекте ORKPOD Archive",
    description: aboutDescription,
    images: [getDefaultSocialImageUrl()],
  },
};

const aboutStructuredData = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "О проекте ORKPOD Archive",
  url: toAbsoluteSiteUrl("/about"),
  inLanguage: "ru-RU",
  description: aboutDescription,
  isPartOf: {
    "@type": "WebSite",
    name: "ORKPOD Archive",
    url: toAbsoluteSiteUrl("/"),
  },
};

const principles = [
  {
    title: "Архив как продукт",
    text: "Каждая запись оформляется как полноценная единица каталога с контекстом, метаданными и маршрутами для дальнейшего просмотра.",
  },
  {
    title: "Discoverability",
    text: "Ключевая цель — быстро находить нужный выпуск по теме, рубрике, платформе и дате, а не вручную прокручивать хронику.",
  },
  {
    title: "Готовность к росту",
    text: "Модель данных и UI остаются расширяемыми для масштабирования контента, автоматизации ingestion-процессов и дальнейшего product-polish.",
  },
];

export default function AboutPage() {
  return (
    <Container className="space-y-10 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutStructuredData) }}
      />

      <Reveal>
        <section className="space-y-4 rounded-[2rem] border border-white/10 bg-[#0a1410]/90 p-7 sm:p-9">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">О проекте</p>
          <h1 className="font-display text-4xl leading-tight text-zinc-100 sm:text-5xl">
            ORKPOD Archive — каталог записей для удобного исследования контента
          </h1>
          <p className="max-w-3xl text-zinc-300">
            Проект собирает материалы ORKPOD в современный discovery-каталог: категории, серии,
            детальные страницы и ясная навигация по выпускам.
          </p>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="grid gap-4 md:grid-cols-3">
          {principles.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <h2 className="font-display text-2xl text-zinc-100">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{item.text}</p>
            </article>
          ))}
        </section>
      </Reveal>
    </Container>
  );
}
