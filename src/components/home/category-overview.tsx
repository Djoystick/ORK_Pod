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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {blocks.map((block, index) => (
        <Link
          key={block.category.id}
          href={`/streams?category=${block.category.slug}`}
          className="group relative overflow-hidden rounded-3xl border border-white/12 bg-[#0a1410] p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/40"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(circle at ${index % 2 ? "80%" : "20%"} 10%, rgba(52, 211, 153, 0.26), transparent 42%)`,
            }}
          />

          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl text-zinc-100 transition group-hover:text-emerald-50">
                {block.category.title}
              </h3>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                {block.itemCount} записей
              </span>
            </div>

            <p className="line-clamp-3 text-sm leading-6 text-zinc-300">{block.category.description}</p>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Серий: {block.seriesCount}</span>
              <span className="uppercase tracking-[0.16em] text-emerald-200/90">Открыть</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
