import Link from "next/link";

import { formatRuDate } from "@/lib/content";
import type { ResolvedContentItem } from "@/types/content";

type ArchiveCardProps = {
  item: ResolvedContentItem;
};

export function ArchiveCard({ item }: ArchiveCardProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.06]">
      <Link href={`/streams/${item.slug}`} className="block">
        <div
          className="relative h-44 border-b border-white/10"
          style={{
            backgroundImage: `linear-gradient(135deg, ${item.cover.palette[0]}, ${item.cover.palette[1]})`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_rgba(0,0,0,0.25)_65%)]" />
          <div className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-zinc-200">
            {item.category.title}
          </div>
          <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-zinc-100">
            {item.platform.title}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-xs text-zinc-400">{formatRuDate(item.publishedAt)}</p>
          <h3 className="font-display text-lg leading-tight text-zinc-100 transition group-hover:text-white">
            {item.title}
          </h3>
          <p className="line-clamp-2 text-sm text-zinc-300">{item.excerpt}</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300">
              {item.series?.title ?? "Без серии"}
            </span>
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300">
              {item.durationMinutes > 0 ? `${item.durationMinutes} мин` : "Длительность TBD"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
