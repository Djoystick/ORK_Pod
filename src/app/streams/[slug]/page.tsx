import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveCard } from "@/components/archive/archive-card";
import { CommunityBlock } from "@/components/community/community-block";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/shared/container";
import { formatRuDate } from "@/lib/content";
import { readCommunityIdentity } from "@/server/auth/community-identity";
import { getPublicCommunityData } from "@/server/services/community-service";
import { getStreamDetailData } from "@/server/services/public-content-service";

type DetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detailData = await getStreamDetailData(slug);
  const item = detailData?.item;

  if (!item) {
    return { title: "Запись не найдена" };
  }

  return {
    title: item.title,
    description: item.excerpt,
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
  const identity = await readCommunityIdentity();
  const community = await getPublicCommunityData(item.id, identity.fingerprint);

  return (
    <Container className="space-y-10 pb-16">
      <Reveal>
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div
            className="relative h-56 border-b border-white/10 sm:h-72"
            style={{
              backgroundImage: `linear-gradient(135deg, ${item.cover.palette[0]}, ${item.cover.palette[1]})`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_rgba(0,0,0,0.35)_70%)]" />
            <div className="absolute inset-x-6 bottom-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-zinc-100">
                {item.category.title}
              </span>
              <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-zinc-100">
                {item.platform.title}
              </span>
            </div>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            <Link href="/streams" className="text-sm text-cyan-300 hover:text-cyan-200">
              ← Вернуться в архив
            </Link>
            <h1 className="font-display text-3xl leading-tight text-zinc-100 sm:text-4xl">
              {item.title}
            </h1>
            <p className="text-sm text-zinc-400">
              {formatRuDate(item.publishedAt)} ·{" "}
              {item.durationMinutes > 0 ? `${item.durationMinutes} мин` : "длительность TBD"} ·{" "}
              {item.series?.title ?? "Без серии"}
            </p>
            <p className="max-w-3xl text-zinc-300">{item.description}</p>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="font-display text-2xl text-zinc-100">Видео / запись</h2>
            <div className="rounded-2xl border border-dashed border-white/20 bg-black/25 p-8 text-center text-zinc-300">
              В этой зоне может быть встроенный плеер. Сейчас используется внешний слот
              платформы.
            </div>
            {item.primaryLink ? (
              <a
                href={item.primaryLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {item.primaryLink.label}
              </a>
            ) : null}
          </article>

          <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="font-display text-2xl text-zinc-100">Внешние ссылки</h2>
            <ul className="space-y-2">
              {item.links.map((link) => (
                <li key={`${item.id}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-white/30 hover:text-white"
                  >
                    <span>{link.label}</span>
                    <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      {link.kind}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300"
                >
                  #{tag.label}
                </span>
              ))}
            </div>
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
