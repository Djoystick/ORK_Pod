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

export async function getHomePageData() {
  const repository = getContentRepository();
  const [taxonomy, archiveItems] = await Promise.all([
    repository.listTaxonomy(),
    repository.listArchiveItems(),
  ]);

  const sortedItems = sortItemsByDate(archiveItems, "newest");

  return {
    featuredItems: getFeaturedItems(sortedItems, 3),
    recentItems: getRecentItems(sortedItems, 6),
    categoryOverview: getCategoryOverview(
      taxonomy.categories,
      taxonomy.series,
      sortedItems,
    ),
  };
}

export async function getArchivePageData() {
  const repository = getContentRepository();
  const [taxonomy, archiveItems] = await Promise.all([
    repository.listTaxonomy(),
    repository.listArchiveItems(),
  ]);

  return {
    initialItems: sortItemsByDate(archiveItems, "newest"),
    filterOptions: buildArchiveFilterOptions(
      taxonomy.categories,
      taxonomy.series,
      taxonomy.platforms,
    ),
  };
}

export async function getStreamDetailData(slug: string) {
  const repository = getContentRepository();
  const [archiveItems, item] = await Promise.all([
    repository.listArchiveItems(),
    repository.getItemBySlug(slug),
  ]);

  if (!item) {
    return null;
  }

  return {
    item,
    related: getRelatedItems(archiveItems, item, 3),
  };
}
