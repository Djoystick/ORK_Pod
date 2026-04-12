import Link from "next/link";

type CategoryOverviewProps = {
  blocks: Array<{
    category: {
      id: string;
      slug: string;
      title: string;
      description: string;
    };
    seriesCount: number;
    itemCount: number;
  }>;
};

export function CategoryOverview({ blocks }: CategoryOverviewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {blocks.map((block) => (
        <Link
          key={block.category.id}
          href={`/streams?category=${block.category.slug}`}
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.06]"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl text-zinc-100">{block.category.title}</h3>
              <span className="rounded-full border border-emerald-300/25 px-3 py-1 text-xs text-zinc-300">
                {block.itemCount} записей
              </span>
            </div>
            <p className="text-sm leading-6 text-zinc-300">{block.category.description}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Серий: {block.seriesCount}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
