import "server-only";

import { categories, contentItems, platforms, seriesList } from "@/data";
import { assertAdminWriteAccess } from "@/server/auth/admin-gate";
import { getContentRepository } from "@/server/repositories/content-repository";
import type { ContentItem, CreateManualContentInput } from "@/types/content";

const DEFAULT_BOOTSTRAP_SLUGS = [
  "inside-stream-editorial-pipeline",
  "retro-air-multi-platform-recap",
  "live-build-nextjs-archive-grid",
];

type BootstrapResult = {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function findTemplateCategorySlug(item: ContentItem) {
  const direct = item.categoryId
    ? categories.find((category) => category.id === item.categoryId)
    : null;
  if (direct) {
    return direct.slug;
  }

  if (item.seriesId) {
    const fromSeries = seriesList.find((series) => series.id === item.seriesId);
    if (fromSeries) {
      const category = categories.find((entry) => entry.id === fromSeries.categoryId);
      if (category) {
        return category.slug;
      }
    }
  }

  return categories[0]?.slug ?? "analysis";
}

function findTemplateSeriesSlug(item: ContentItem) {
  if (!item.seriesId) {
    return undefined;
  }

  return seriesList.find((series) => series.id === item.seriesId)?.slug;
}

function findTemplatePlatformSlug(item: ContentItem) {
  return platforms.find((platform) => platform.id === item.platformId)?.slug ?? "youtube";
}

function findTemplateExternalUrl(item: ContentItem) {
  return item.links[0]?.url ?? "";
}

function mapTemplateToCreateInput(
  item: ContentItem,
  bootstrapKey?: string,
): CreateManualContentInput | null {
  const externalUrl = findTemplateExternalUrl(item);
  if (!externalUrl) {
    return null;
  }

  return {
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    description: item.description,
    body: item.body,
    categorySlug: findTemplateCategorySlug(item),
    seriesSlug: findTemplateSeriesSlug(item),
    platformSlug: findTemplatePlatformSlug(item),
    externalUrl,
    publishedAt: item.publishedAt ?? undefined,
    status: "published",
    sourceType: "manual",
    bootstrapKey,
  };
}

function getBootstrapTemplates() {
  const mapped = DEFAULT_BOOTSTRAP_SLUGS.map((slug) =>
    contentItems.find((item) => item.slug === slug),
  ).filter(Boolean) as ContentItem[];

  if (mapped.length >= 3) {
    return mapped;
  }

  return contentItems.slice(0, 3);
}

export async function bootstrapInitialPublishedContent(params: {
  host: string;
  bootstrapKey?: string;
}): Promise<BootstrapResult> {
  await assertAdminWriteAccess({
    host: params.host,
    providedKey: params.bootstrapKey,
  });

  const repository = getContentRepository();
  const [existingItems, templates] = await Promise.all([
    repository.listAdminContentItems(),
    Promise.resolve(getBootstrapTemplates()),
  ]);

  const existingSlugs = new Set(existingItems.map((item) => item.slug));

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const template of templates) {
    const payload = mapTemplateToCreateInput(template, params.bootstrapKey);
    if (!payload) {
      failed += 1;
      errors.push(`Шаблон "${template.slug}" пропущен: не найден внешний URL.`);
      continue;
    }

    if (existingSlugs.has(payload.slug)) {
      skipped += 1;
      continue;
    }

    try {
      await repository.createManualContentItem(payload);
      created += 1;
      existingSlugs.add(payload.slug);
    } catch (error) {
      failed += 1;
      errors.push(
        `Не удалось создать "${payload.slug}": ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  return {
    created,
    skipped,
    failed,
    errors,
  };
}

