import { categories as seedCategories, contentItems, platforms as seedPlatforms, seriesList, tags as seedTags } from "@/data";
import { resolveContentItemCover } from "@/lib/cover";
import type {
  ArchiveFilters,
  Category,
  ContentItem,
  ContentSource,
  ImportStatus,
  ModerationStatus,
  Platform,
  ResolvedContentItem,
  SelectOption,
  Series,
  SortMode,
  SourceType,
  Tag,
} from "@/types/content";

type TaxonomyBundle = {
  categories: Category[];
  series: Series[];
  platforms: Platform[];
  tags: Tag[];
};

const defaultDate = "2025-01-01T00:00:00.000Z";

function ensureIsoDate(value?: string | null) {
  if (!value) {
    return defaultDate;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return defaultDate;
  }

  return parsed.toISOString();
}

function inferSource(item: ContentItem): ContentSource | null {
  const sourceType: SourceType = item.sourceType ?? "manual";
  const createdAt = ensureIsoDate(item.createdAt ?? item.publishedAt);
  const updatedAt = ensureIsoDate(item.updatedAt ?? createdAt);

  return {
    id: item.contentSourceId ?? `source-${item.id}`,
    sourceType,
    externalSourceId: item.externalSourceId ?? null,
    importStatus: (item.importStatus ?? "not_applicable") as ImportStatus,
    sourcePayload: item.sourcePayload ?? null,
    importedAt:
      sourceType === "imported" ? ensureIsoDate(item.publishedAt ?? createdAt) : null,
    createdAt,
    updatedAt,
  };
}

export function resolveContentItems(
  items: ContentItem[],
  taxonomy: TaxonomyBundle = {
    categories: seedCategories,
    series: seriesList,
    platforms: seedPlatforms,
    tags: seedTags,
  },
): ResolvedContentItem[] {
  const categoryMap = new Map(taxonomy.categories.map((category) => [category.id, category]));
  const seriesMap = new Map(taxonomy.series.map((series) => [series.id, series]));
  const platformMap = new Map(taxonomy.platforms.map((platform) => [platform.id, platform]));
  const tagMap = new Map(taxonomy.tags.map((tag) => [tag.id, tag]));

  return items.map((item) => {
    const series = item.seriesId ? seriesMap.get(item.seriesId) ?? null : null;
    const platform = platformMap.get(item.platformId);

    if (!platform) {
      throw new Error(`Invalid platform reference in content item ${item.id}`);
    }

    const categoryId = item.categoryId ?? series?.categoryId;
    if (!categoryId) {
      throw new Error(`Category cannot be resolved for content item ${item.id}`);
    }

    const category = categoryMap.get(categoryId);
    if (!category) {
      throw new Error(`Invalid category reference in content item ${item.id}`);
    }

    const createdAt = ensureIsoDate(item.createdAt ?? item.publishedAt);
    const updatedAt = ensureIsoDate(item.updatedAt ?? createdAt);
    const publishedAt = ensureIsoDate(item.publishedAt ?? createdAt);
    const moderationStatus: ModerationStatus = item.moderationStatus ?? "clean";

    return {
      ...item,
      categoryId,
      seriesId: item.seriesId ?? null,
      sourceType: item.sourceType ?? "manual",
      importStatus: item.importStatus ?? "not_applicable",
      status: item.status ?? "published",
      moderationStatus,
      cover: resolveContentItemCover(item),
      createdAt,
      updatedAt,
      publishedAt,
      series,
      category,
      platform,
      source: inferSource(item),
      tags: item.tagIds
        .map((tagId) => tagMap.get(tagId))
        .filter((value): value is Tag => Boolean(value)),
      primaryLink: item.links[0],
    };
  });
}

export function resolveSeedItems() {
  return resolveContentItems(contentItems);
}

export function sortItemsByDate(items: ResolvedContentItem[], sort: SortMode = "newest") {
  const factor = sort === "oldest" ? 1 : -1;

  return [...items].sort(
    (a, b) =>
      (new Date(a.publishedAt ?? defaultDate).getTime() -
        new Date(b.publishedAt ?? defaultDate).getTime()) *
      factor,
  );
}

export function getFeaturedItems(items: ResolvedContentItem[], limit = 4) {
  return sortItemsByDate(
    items.filter((item) => item.featured),
    "newest",
  ).slice(0, limit);
}

export function getRecentItems(items: ResolvedContentItem[], limit = 6) {
  return sortItemsByDate(items, "newest").slice(0, limit);
}

export function getRelatedItems(
  items: ResolvedContentItem[],
  currentItem: ResolvedContentItem,
  limit = 3,
) {
  return items
    .filter((candidate) => candidate.id !== currentItem.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.seriesId && candidate.seriesId === currentItem.seriesId) score += 4;
      if (candidate.category.id === currentItem.category.id) score += 2;
      const sharedTags = candidate.tagIds.filter((tagId) =>
        currentItem.tagIds.includes(tagId),
      ).length;
      score += sharedTags;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate)
    .slice(0, limit);
}

export function getCategoryOverview(
  categories: Category[],
  series: Series[],
  items: ResolvedContentItem[],
) {
  return categories.map((category) => {
    const categorySeries = series.filter((seriesItem) => seriesItem.categoryId === category.id);
    const categoryItems = items.filter((item) => item.category.id === category.id);

    return {
      category,
      seriesCount: categorySeries.length,
      itemCount: categoryItems.length,
      latestItem: sortItemsByDate(categoryItems, "newest")[0] ?? null,
      series: categorySeries,
    };
  });
}

export function buildArchiveFilterOptions(
  categories: Category[],
  series: Series[],
  platforms: Platform[],
) {
  const categoryOptions: SelectOption[] = [
    { value: "all", label: "Все категории" },
    ...categories.map((category) => ({
      value: category.slug,
      label: category.title,
    })),
  ];

  const seriesOptions: SelectOption[] = [
    { value: "all", label: "Все серии" },
    ...series.map((seriesItem) => ({
      value: seriesItem.slug,
      label: seriesItem.title,
    })),
  ];

  const platformOptions: SelectOption[] = [
    { value: "all", label: "Все платформы" },
    ...platforms.map((platform) => ({
      value: platform.slug,
      label: platform.title,
    })),
  ];

  return {
    categoryOptions,
    seriesOptions,
    platformOptions,
  };
}

export function queryArchiveItems(items: ResolvedContentItem[], filters: ArchiveFilters) {
  const q = filters.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const matchesCategory =
      filters.category === "all" || item.category.slug === filters.category;
    const matchesSeries =
      filters.series === "all" || item.series?.slug === filters.series;
    const matchesPlatform =
      filters.platform === "all" || item.platform.slug === filters.platform;

    if (!q) {
      return matchesCategory && matchesSeries && matchesPlatform;
    }

    const searchable = [
      item.title,
      item.excerpt,
      item.description,
      item.body ?? "",
      item.series?.title ?? "",
      item.category.title,
      item.platform.title,
      ...item.tags.map((tag) => tag.label),
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesCategory &&
      matchesSeries &&
      matchesPlatform &&
      searchable.includes(q)
    );
  });

  return sortItemsByDate(filtered, filters.sort);
}

export function formatRuDate(value?: string | null) {
  const date = new Date(value ?? defaultDate);

  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export const seedTaxonomy = {
  categories: seedCategories,
  series: seriesList,
  platforms: seedPlatforms,
  tags: seedTags,
};
