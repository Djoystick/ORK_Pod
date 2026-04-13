import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveCard } from "@/components/archive/archive-card";
import { DetailDescriptionPanel } from "@/components/archive/detail-description-panel";
import { DetailMediaPlayer } from "@/components/archive/detail-media-player";
import { CommunityBlock } from "@/components/community/community-block";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { formatRuDate } from "@/lib/content";
import {
  getDefaultSocialImageUrl,
  getSocialImageUrl,
  pickMetaDescription,
  toAbsoluteSiteUrl,
} from "@/lib/seo";
import { readCommunityIdentity } from "@/server/auth/community-identity";
import { getPublicCommunityData } from "@/server/services/community-service";
import { getStreamDetailData } from "@/server/services/public-content-service";

type DetailPageProps = {
  params: Promise<{ slug: string }>;
};

function toIsoDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }

  return `PT${Math.round(minutes)}M`;
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detailData = await getStreamDetailData(slug);
  const item = detailData?.item;

  if (!item) {
    return {
      title: "Запись не найдена",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = pickMetaDescription(item.excerpt, item.description);
  const socialImage =
    item.cover.kind === "image" && item.cover.src
      ? getSocialImageUrl(item.cover.src)
      : getDefaultSocialImageUrl();

  return {
    title: item.title,
    description,
    keywords: [
      item.category.title,
      item.platform.title,
      ...(item.series ? [item.series.title] : []),
      ...item.tags.map((tag) => tag.label),
    ],
    alternates: {
      canonical: `/streams/${item.slug}`,
    },
    openGraph: {
      type: "article",
      title: item.title,
      description,
      url: `/streams/${item.slug}`,
      publishedTime: item.publishedAt ?? undefined,
      section: item.category.title,
      tags: item.tags.map((tag) => tag.label),
      images: [
        {
          url: socialImage,
          alt: item.cover.alt || item.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images: [socialImage],
    },
  };
}

export default async function StreamDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const detailData = await getStreamDetailData(slug);
  if (!detailData) {
    notFound();
  }

  const item = detailData.item;
  const related = detailData.related;
  const requestHost = (await headers()).get("host") ?? "";
  const identity = await readCommunityIdentity();
  const community = await getPublicCommunityData(item.id, identity.fingerprint);
  const detailDescription = pickMetaDescription(item.excerpt, item.description);
  const socialImage =
    item.cover.kind === "image" && item.cover.src
      ? getSocialImageUrl(item.cover.src)
      : getDefaultSocialImageUrl();

  const videoStructuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: item.title,
    description: detailDescription,
    thumbnailUrl: [socialImage],
    uploadDate: item.publishedAt ?? undefined,
    duration: toIsoDuration(item.durationMinutes),
    inLanguage: "ru-RU",
    url: toAbsoluteSiteUrl(`/streams/${item.slug}`),
    mainEntityOfPage: toAbsoluteSiteUrl(`/streams/${item.slug}`),
    genre: item.category.title,
    keywords: item.tags.map((tag) => tag.label).join(", "),
    publisher: {
      "@type": "Organization",
      name: "ORKPOD Archive",
      logo: {
        "@type": "ImageObject",
        url: toAbsoluteSiteUrl("/branding/icon.jpg"),
      },
    },
    contentUrl: item.primaryLink?.url ?? undefined,
  };

  return (
    <Container className="space-y-10 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoStructuredData) }}
      />

      <Reveal>
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1410]/90">
          <div
            className="relative h-60 border-b border-white/10 sm:h-80"
            style={{
              backgroundImage: `linear-gradient(135deg, ${item.cover.palette[0]}, ${item.cover.palette[1]})`,
            }}
          >
            {item.cover.kind === "image" && item.cover.src ? (
              <Image
                src={item.cover.src}
                alt={item.cover.alt || item.title}
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_rgba(0,0,0,0.35)_70%)]" />
            <div className="absolute inset-x-6 bottom-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-black/45 px-3 py-1 text-xs text-zinc-100">
                {item.category.title}
              </span>
              <span className="rounded-full bg-black/45 px-3 py-1 text-xs text-zinc-100">
                {item.platform.title}
              </span>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <Link href="/streams" className="text-sm text-emerald-300 hover:text-emerald-200">
              ← Вернуться в архив
            </Link>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <h1 className="font-display text-3xl leading-tight text-zinc-100 sm:text-4xl">{item.title}</h1>
                <p className="text-sm text-zinc-300">{item.excerpt}</p>
                <p className="text-sm text-zinc-400">
                  {formatRuDate(item.publishedAt)} ·{" "}
                  {item.durationMinutes > 0 ? `${item.durationMinutes} мин` : "Длительность TBD"} ·{" "}
                  {item.series?.title ?? "Без серии"}
                </p>
              </div>

              <aside className="space-y-3 rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Навигация по выпуску</p>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1 text-xs text-emerald-100"
                    >
                      #{tag.label}
                    </span>
                  ))}
                </div>
                {item.primaryLink ? (
                  <a
                    href={item.primaryLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center rounded-xl border border-white/20 px-4 text-sm text-zinc-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
                  >
                    {item.primaryLink.label}
                  </a>
                ) : null}
              </aside>
            </div>

            <DetailMediaPlayer item={item} requestHost={requestHost} />
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <DetailDescriptionPanel item={item} />

          <aside className="space-y-3 rounded-3xl border border-white/10 bg-[#0a1410]/85 p-5 sm:p-6">
            <h2 className="font-display text-2xl text-zinc-100">Внешние ссылки</h2>
            <ul className="space-y-2">
              {item.links.map((link) => (
                <li key={`${item.id}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-50"
                  >
                    <span>{link.label}</span>
                    <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{link.kind}</span>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <CommunityBlock
          slug={item.slug}
          comments={community.comments}
          reactionSummary={community.reactionSummary}
          initialDisplayName={identity.displayName}
          policyMessage={community.policy.message}
          communityWrite={{
            canWrite: community.policy.canWrite,
            requiresAuth: community.policy.requiresAuth,
            writeMode: community.policy.writeMode,
          }}
        />
      </Reveal>

      <Reveal delay={0.1} className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Related</p>
          <h2 className="font-display text-3xl text-zinc-100">Похожие записи</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {related.map((relatedItem) => (
            <ArchiveCard key={relatedItem.id} item={relatedItem} />
          ))}
        </div>
      </Reveal>
    </Container>
  );
}
