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

  return (
    <section className="space-y-6">
      <ArchiveControls
        filters={filters}
        categoryOptions={filterOptions.categoryOptions}
        seriesOptions={filterOptions.seriesOptions}
        platformOptions={filterOptions.platformOptions}
        onChange={handleChange}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-300">
          Найдено: <span className="font-semibold text-zinc-100">{items.length}</span>
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-10 text-center text-zinc-300">
          По вашему запросу ничего не найдено. Попробуйте сбросить фильтры.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ArchiveCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
