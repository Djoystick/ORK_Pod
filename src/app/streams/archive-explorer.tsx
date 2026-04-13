"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArchiveCard } from "@/components/archive/archive-card";
import { ArchiveControls } from "@/components/archive/archive-controls";
import { queryArchiveItems } from "@/lib/content";
import type { ArchiveFilters, ResolvedContentItem, SelectOption } from "@/types/content";

function readFilters(params: Pick<URLSearchParams, "get">): ArchiveFilters {
  const sortValue = params.get("sort");

  return {
    search: params.get("q") ?? "",
    category: params.get("category") ?? "all",
    series: params.get("series") ?? "all",
    platform: params.get("platform") ?? "all",
    sort: sortValue === "oldest" ? "oldest" : "newest",
  };
}

type ArchiveExplorerProps = {
  initialItems: ResolvedContentItem[];
  filterOptions: {
    categoryOptions: SelectOption[];
    seriesOptions: SelectOption[];
    platformOptions: SelectOption[];
  };
};

export function ArchiveExplorer({ initialItems, filterOptions }: ArchiveExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = readFilters(searchParams);
  const items = queryArchiveItems(initialItems, filters);

  const handleChange = (next: Partial<ArchiveFilters>) => {
    const params = new URLSearchParams(searchParams.toString());

    const merged: ArchiveFilters = {
      ...filters,
      ...next,
    };

    if (merged.search) {
      params.set("q", merged.search);
    } else {
      params.delete("q");
    }

    const pairs: Array<["category" | "series" | "platform" | "sort", string]> = [
      ["category", merged.category],
      ["series", merged.series],
      ["platform", merged.platform],
      ["sort", merged.sort],
    ];

    for (const [key, value] of pairs) {
      if (value === "all" || (key === "sort" && value === "newest")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleReset = () => {
    router.replace(pathname, { scroll: false });
  };

  const activePills: string[] = [];
  if (filters.search.trim()) activePills.push(`Запрос: ${filters.search.trim()}`);
  if (filters.category !== "all") activePills.push(`Категория: ${filters.category}`);
  if (filters.series !== "all") activePills.push(`Серия: ${filters.series}`);
  if (filters.platform !== "all") activePills.push(`Платформа: ${filters.platform}`);
  if (filters.sort !== "newest") activePills.push("Сортировка: старые");

  return (
    <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="xl:sticky xl:top-24 xl:h-fit">
        <ArchiveControls
          filters={filters}
          categoryOptions={filterOptions.categoryOptions}
          seriesOptions={filterOptions.seriesOptions}
          platformOptions={filterOptions.platformOptions}
          onChange={handleChange}
          onReset={handleReset}
        />
      </aside>

      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-300">
              Найдено: <span className="font-semibold text-zinc-100">{items.length}</span>
            </p>
            {activePills.length > 0 ? (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
              >
                Очистить фильтры
              </button>
            ) : null}
          </div>
          {activePills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activePills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100"
                >
                  {pill}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Показывается полный каталог без ограничений.</p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.02] p-10 text-center text-zinc-300">
            По вашему запросу ничего не найдено. Попробуйте сбросить фильтры или изменить строку поиска.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <ArchiveCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
