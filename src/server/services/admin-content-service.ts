import "server-only";

import { sanitizeSlug } from "@/lib/slug";
import { resolveAdminGateContext, assertAdminWriteAccess } from "@/server/auth/admin-gate";
import { getContentRepository } from "@/server/repositories/content-repository";
import {
  getIngestionRuntimeUnavailableMessage,
  isIngestionRuntimeUnavailableError,
} from "@/server/services/ingestion-runtime-guard";
import type {
  ImportRun,
  ContentStatus,
  CreateManualContentInput,
  ResolvedContentItem,
  UpdateContentItemInput,
} from "@/types/content";

export type AdminBootstrapMode = Awaited<ReturnType<typeof resolveAdminGateContext>>["mode"];

type AdminContentFilterInput = {
  q?: string;
  status?: string;
  sourceType?: string;
  platform?: string;
  category?: string;
  review?: string;
};

type AutomationReviewState = "review_needed" | "review_light" | "auto_published";

function readAutomationReviewState(item: ResolvedContentItem): AutomationReviewState | null {
  const payload = item.sourcePayload;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const payloadRecord = payload as Record<string, unknown>;
  const automation =
    payloadRecord.automation && typeof payloadRecord.automation === "object"
      ? (payloadRecord.automation as Record<string, unknown>)
      : null;
  if (
    automation?.reviewState === "review_needed" ||
    automation?.reviewState === "review_light" ||
    automation?.reviewState === "auto_published"
  ) {
    return automation.reviewState;
  }

  const mapping =
    payloadRecord.mapping && typeof payloadRecord.mapping === "object"
      ? (payloadRecord.mapping as Record<string, unknown>)
      : null;

  if (mapping?.needsReview === true || mapping?.needsReview === undefined) {
    return item.sourceType === "imported" ? "review_needed" : null;
  }

  if (item.sourceType === "imported") {
    return "review_light";
  }

  return null;
}

function parseStatus(value: string): ContentStatus {
  if (value === "draft" || value === "archived") {
    return value;
  }

  return "published";
}

function parseManualCreateInput(data: FormData): CreateManualContentInput {
  const title = String(data.get("title") ?? "").trim();
  const slug = sanitizeSlug(String(data.get("slug") ?? ""));
  const excerpt = String(data.get("excerpt") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const body = String(data.get("body") ?? "").trim();
  const categorySlug = String(data.get("category") ?? "").trim();
  const seriesSlug = String(data.get("series") ?? "").trim();
  const platformSlug = String(data.get("platform") ?? "").trim();
  const externalUrl = String(data.get("externalUrl") ?? "").trim();
  const publishedAt = String(data.get("publishedAt") ?? "").trim();
  const bootstrapKey = String(data.get("bootstrapKey") ?? "").trim();
  const status = parseStatus(String(data.get("status") ?? "published"));

  if (!title || !slug || !excerpt || !description || !categorySlug || !platformSlug || !externalUrl) {
    throw new Error("Заполните обязательные поля формы.");
  }

  return {
    title,
    slug,
    excerpt,
    description,
    body: body || undefined,
    categorySlug,
    seriesSlug: seriesSlug || undefined,
    platformSlug,
    externalUrl,
    publishedAt: publishedAt || undefined,
    status,
    sourceType: "manual",
    bootstrapKey: bootstrapKey || undefined,
  };
}

function parseUpdateInput(data: FormData): UpdateContentItemInput & { bootstrapKey?: string } {
  const id = String(data.get("id") ?? "").trim();
  const title = String(data.get("title") ?? "").trim();
  const slug = sanitizeSlug(String(data.get("slug") ?? ""));
  const excerpt = String(data.get("excerpt") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const body = String(data.get("body") ?? "").trim();
  const categorySlug = String(data.get("category") ?? "").trim();
  const seriesSlug = String(data.get("series") ?? "").trim();
  const platformSlug = String(data.get("platform") ?? "").trim();
  const externalUrl = String(data.get("externalUrl") ?? "").trim();
  const publishedAt = String(data.get("publishedAt") ?? "").trim();
  const bootstrapKey = String(data.get("bootstrapKey") ?? "").trim();
  const status = parseStatus(String(data.get("status") ?? "published"));

  if (!id || !title || !slug || !excerpt || !description || !categorySlug || !platformSlug || !externalUrl) {
    throw new Error("Заполните обязательные поля формы.");
  }

  return {
    id,
    title,
    slug,
    excerpt,
    description,
    body: body || undefined,
    categorySlug,
    seriesSlug: seriesSlug || undefined,
    platformSlug,
    externalUrl,
    publishedAt: publishedAt || undefined,
    status,
    bootstrapKey: bootstrapKey || undefined,
  };
}

function applyAdminContentFilters(
  items: ResolvedContentItem[],
  filters: AdminContentFilterInput,
) {
  const q = (filters.q ?? "").trim().toLowerCase();

  return items.filter((item) => {
    const matchesStatus = !filters.status || filters.status === "all" || item.status === filters.status;
    const matchesSourceType =
      !filters.sourceType || filters.sourceType === "all" || item.sourceType === filters.sourceType;
    const matchesPlatform =
      !filters.platform || filters.platform === "all" || item.platform.slug === filters.platform;
    const matchesCategory =
      !filters.category || filters.category === "all" || item.category.slug === filters.category;
    const reviewFilter = filters.review ?? "all";
    const reviewState = readAutomationReviewState(item);
    const matchesReview =
      reviewFilter === "all" ||
      (reviewFilter === "review_needed" && reviewState === "review_needed") ||
      (reviewFilter === "review_light" && reviewState === "review_light") ||
      (reviewFilter === "auto_published" && reviewState === "auto_published") ||
      (reviewFilter === "no_signals" && reviewState === null);

    if (!q) {
      return matchesStatus && matchesSourceType && matchesPlatform && matchesCategory && matchesReview;
    }

    const searchable = [
      item.title,
      item.excerpt,
      item.description,
      item.slug,
      item.platform.title,
      item.category.title,
      item.series?.title ?? "",
      item.sourceType ?? "",
      item.status ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesStatus &&
      matchesSourceType &&
      matchesPlatform &&
      matchesCategory &&
      matchesReview &&
      searchable.includes(q)
    );
  });
}

export async function getAdminOverviewData(host: string) {
  const gate = await resolveAdminGateContext(host);
  if (!gate.canAccessAdmin) {
    return {
      gate,
      stats: null,
      ingestionRuntimeWarning: null as string | null,
    };
  }

  const repository = getContentRepository();
  const [items, channels, moderationComments] = await Promise.all([
    repository.listAdminContentItems(),
    repository.listSourceChannels(),
    repository.listModerationComments({ status: "all", limit: 500 }),
  ]);
  let importRuns: ImportRun[] = [];
  let ingestionRuntimeWarning: string | null = null;

  try {
    importRuns = await repository.listImportRuns(20);
  } catch (error) {
    if (!isIngestionRuntimeUnavailableError(error)) {
      throw error;
    }
    ingestionRuntimeWarning = getIngestionRuntimeUnavailableMessage();
  }

  const statusCounts = items.reduce(
    (acc, item) => {
      const status = item.status ?? "draft";
      acc[status] += 1;
      return acc;
    },
    { draft: 0, published: 0, archived: 0 },
  );

  return {
    gate,
    ingestionRuntimeWarning,
    stats: {
      totalContent: items.length,
      statusCounts,
      totalSources: channels.length,
      activeSources: channels.filter((channel) => channel.isActive).length,
      importRunsTotal: importRuns.length,
      importRunsFailed: importRuns.filter((run) => run.status === "failed").length,
      lastImportRunAt: importRuns[0]?.startedAt ?? null,
      commentsTotal: moderationComments.length,
      commentsPending: moderationComments.filter((comment) => comment.status === "pending")
        .length,
    },
  };
}

export async function getAdminCreateFormData(host: string) {
  const repository = getContentRepository();
  const taxonomy = await repository.listTaxonomy();
  const gate = await resolveAdminGateContext(host);

  return {
    gate,
    categories: taxonomy.categories,
    series: taxonomy.series,
    platforms: taxonomy.platforms,
  };
}

export async function getAdminContentListData(
  host: string,
  filters: AdminContentFilterInput,
) {
  const repository = getContentRepository();
  const gate = await resolveAdminGateContext(host);

  if (!gate.canAccessAdmin) {
    return {
      gate,
      filters: {
        q: filters.q ?? "",
        status: filters.status ?? "all",
        sourceType: filters.sourceType ?? "all",
        platform: filters.platform ?? "all",
        category: filters.category ?? "all",
        review: filters.review ?? "all",
      },
      items: [],
      taxonomy: await repository.listTaxonomy(),
    };
  }

  const [taxonomy, items] = await Promise.all([
    repository.listTaxonomy(),
    repository.listAdminContentItems(),
  ]);

  const normalizedFilters = {
    q: filters.q ?? "",
    status: filters.status ?? "all",
    sourceType: filters.sourceType ?? "all",
    platform: filters.platform ?? "all",
    category: filters.category ?? "all",
    review: filters.review ?? "all",
  };

  return {
    gate,
    filters: normalizedFilters,
    items: applyAdminContentFilters(items, normalizedFilters),
    taxonomy,
  };
}

export async function getAdminContentEditData(host: string, id: string) {
  const repository = getContentRepository();
  const [taxonomy, item] = await Promise.all([
    repository.listTaxonomy(),
    repository.getAdminItemById(id),
  ]);
  const gate = await resolveAdminGateContext(host);

  return {
    gate,
    taxonomy,
    item,
    initialExternalUrl:
      item?.primaryLink?.url ?? item?.links.find((entry) => entry.url)?.url ?? "",
  };
}

export async function createManualContentViaRepository(formData: FormData, host: string) {
  const payload = parseManualCreateInput(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: payload.bootstrapKey,
  });

  const repository = getContentRepository();
  return repository.createManualContentItem(payload);
}

export async function updateContentViaRepository(formData: FormData, host: string) {
  const payload = parseUpdateInput(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: payload.bootstrapKey,
  });

  const repository = getContentRepository();
  return repository.updateContentItem(payload);
}

export async function setContentStatusViaRepository({
  host,
  id,
  status,
  bootstrapKey,
}: {
  host: string;
  id: string;
  status: ContentStatus;
  bootstrapKey?: string;
}) {
  await assertAdminWriteAccess({
    host,
    providedKey: bootstrapKey,
  });

  const repository = getContentRepository();
  return repository.setContentItemStatus(id, status);
}
