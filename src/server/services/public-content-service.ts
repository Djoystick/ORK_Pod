import "server-only";

import {
  buildArchiveFilterOptions,
  getCategoryOverview,
  getFeaturedItems,
  getRecentItems,
  getRelatedItems,
  sortItemsByDate,
} from "@/lib/content";
import { getContentRepository } from "@/server/repositories/content-repository";

async function readTaxonomyAndArchiveItems() {
  const repository = getContentRepository();
  return Promise.all([repository.listTaxonomy(), repository.listArchiveItems()]);
}

export async function getHomePageData() {
  const [taxonomy, archiveItems] = await readTaxonomyAndArchiveItems();
  const sortedItems = sortItemsByDate(archiveItems, "newest");

  return {
    featuredItems: getFeaturedItems(sortedItems, 3),
    recentItems: getRecentItems(sortedItems, 6),
    categoryOverview: getCategoryOverview(taxonomy.categories, taxonomy.series, sortedItems),
  };
}

export async function getArchivePageData() {
  const [taxonomy, archiveItems] = await readTaxonomyAndArchiveItems();
  const sortedItems = sortItemsByDate(archiveItems, "newest");

  return {
    initialItems: sortedItems,
    filterOptions: buildArchiveFilterOptions(
      taxonomy.categories,
      taxonomy.series,
      taxonomy.platforms,
    ),
  };
}

export async function getStreamDetailData(slug: string) {
  const repository = getContentRepository();
  const archiveItems = await repository.listArchiveItems();
  const item = archiveItems.find((entry) => entry.slug === slug) ?? null;

  if (!item) {
    return null;
  }

  return {
    item,
    related: getRelatedItems(archiveItems, item, 3),
  };
}
