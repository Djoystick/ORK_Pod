import type { MetadataRoute } from "next";

import { toAbsoluteSiteUrl } from "@/lib/seo";
import { getContentRepository } from "@/server/repositories/content-repository";
import type { ResolvedContentItem } from "@/types/content";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: toAbsoluteSiteUrl("/"),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: toAbsoluteSiteUrl("/streams"),
    changeFrequency: "daily",
    priority: 0.95,
  },
  {
    url: toAbsoluteSiteUrl("/about"),
    changeFrequency: "monthly",
    priority: 0.6,
  },
];

function toLastModified(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let items: ResolvedContentItem[] = [];

  try {
    const repository = getContentRepository();
    items = await repository.listArchiveItems();
  } catch (error) {
    console.error("[sitemap] failed to read archive items, returning static routes only", error);
  }

  const detailRoutes: MetadataRoute.Sitemap = items.map((item) => {
    const imageUrl =
      item.cover.kind === "image" && item.cover.src
        ? item.cover.src.startsWith("http://") || item.cover.src.startsWith("https://")
          ? item.cover.src
          : toAbsoluteSiteUrl(item.cover.src)
        : undefined;

    return {
      url: toAbsoluteSiteUrl(`/streams/${item.slug}`),
      lastModified: toLastModified(item.updatedAt ?? item.publishedAt),
      changeFrequency: "weekly",
      priority: 0.8,
      images: imageUrl ? [imageUrl] : undefined,
    };
  });

  return [...staticRoutes, ...detailRoutes];
}
