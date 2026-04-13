import Image from "next/image";
import Link from "next/link";

import { formatRuDate } from "@/lib/content";
import type { ResolvedContentItem } from "@/types/content";

type ArchiveCardProps = {
  item: ResolvedContentItem;
};

export function ArchiveCard({ item }: ArchiveCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/12 bg-[#0b1511] shadow-[0_20px_60px_-28px_rgba(16,185,129,0.35)] transition duration-300 hover:-translate-y-1 hover:border-emerald-300/45">
      <Link href={`/streams/${item.slug}`} className="block">
        <div
          className="relative h-48 border-b border-white/10"
          style={{
            backgroundImage: `linear-gradient(135deg, ${item.cover.palette[0]}, ${item.cover.palette[1]})`,
          }}
        >
          {item.cover.kind === "image" && item.cover.src ? (
            <Image
              src={item.cover.src}
              alt={item.cover.alt || item.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,7,0.05)_0%,rgba(4,10,7,0.52)_55%,rgba(4,10,7,0.86)_100%)]" />

          <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
            <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-100">
              {item.category.title}
            </span>
            <span className="rounded-full border border-emerald-300/35 bg-emerald-300/15 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-100">
              {item.platform.title}
            </span>
          </div>

          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2 text-xs text-zinc-100">
            <span>{formatRuDate(item.publishedAt)}</span>
            <span>{item.durationMinutes > 0 ? `${item.durationMinutes} мин` : "Длительность TBD"}</span>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <h3 className="font-display text-xl leading-tight text-zinc-100 transition group-hover:text-emerald-50">
            {item.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-zinc-300">{item.excerpt}</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
              {item.series?.title ?? "Без серии"}
            </span>
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={`${item.id}-${tag.id}`}
                className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1 text-xs text-emerald-100/90"
              >
                #{tag.label}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
