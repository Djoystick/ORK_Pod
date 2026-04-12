import { randomUUID } from "node:crypto";

import "server-only";

import { categories, platforms, seriesList, tags } from "@/data";
import { resolveContentItems, sortItemsByDate } from "@/lib/content";
import {
  fetchYouTubeChannelVideos,
  type NormalizedYouTubeVideo,
} from "@/server/services/youtube-ingestion-service";
import {
  readLocalFallbackContentItems,
  readLocalFallbackComments,
  readLocalFallbackImportRuns,
  readLocalFallbackReactions,
  readLocalFallbackSourceChannels,
  writeLocalFallbackContentItems,
  writeLocalFallbackComments,
  writeLocalFallbackImportRuns,
  writeLocalFallbackReactions,
  writeLocalFallbackSourceChannels,
} from "@/server/storage/local-fallback-store";
import type {
  CommentRecord,
  CommentStatus,
  ContentItem,
  ContentStatus,
  CreateCommentInput,
  CreateManualContentInput,
  CreateSourceChannelInput,
  ExternalLink,
  ImportRun,
  ImportRunTrigger,
  ImportRunItemResult,
  ReactionRecord,
  UpdateCommentModerationInput,
  ResolvedSourceChannel,
  SourceChannel,
  UpdateContentItemInput,
  UpsertReactionInput,
  UpsertReactionResult,
} from "@/types/content";
import type { ContentRepository } from "@/types/repository";

const fallbackPalettes: Array<[string, string]> = [
  ["#1D4ED8", "#0F172A"],
  ["#0F766E", "#022C22"],
  ["#7C3AED", "#0F172A"],
  ["#0369A1", "#111827"],
  ["#BE123C", "#1F2937"],
];

const DEFAULT_IMPORTED_STATUS: ContentStatus = "draft";

function pickPalette(seed: string): [string, string] {
  const score = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackPalettes[score % fallbackPalettes.length];
}

function ensureValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    throw new Error("Некорректный внешний URL");
  }
}

function toIso(value?: string | null) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

async function getResolvedItems() {
  const items = await readLocalFallbackContentItems();
  return resolveContentItems(items, {
    categories,
    series: seriesList,
    platforms,
    tags,
  });
}

function resolveCategoryAndSeries(input: {
  categorySlug: string;
  seriesSlug?: string;
}) {
  const category = categories.find((entry) => entry.slug === input.categorySlug);
  if (!category) {
    throw new Error("Категория не найдена");
  }

  const selectedSeries = input.seriesSlug
    ? seriesList.find((entry) => entry.slug === input.seriesSlug)
    : null;

  if (input.seriesSlug && !selectedSeries) {
    throw new Error("Серия не найдена");
  }
  if (selectedSeries && selectedSeries.categoryId !== category.id) {
    throw new Error("Серия не принадлежит выбранной категории");
  }

  return { category, series: selectedSeries };
}

function resolvePlatformBySlug(platformSlug: string) {
  const platform = platforms.find((entry) => entry.slug === platformSlug);
  if (!platform) {
    throw new Error("Платформа не найдена");
  }

  return platform;
}

function updatePrimaryLink(item: ContentItem, url: string): ExternalLink[] {
  const nextLinks = [...item.links];
  const primaryIndex = nextLinks.findIndex((entry) => entry.label === "Открыть оригинал");

  if (primaryIndex >= 0) {
    nextLinks[primaryIndex] = {
      ...nextLinks[primaryIndex],
      url,
    };
    return nextLinks;
  }

  return [
    {
      kind: item.platformId.includes("youtube") ? "youtube" : "video",
      label: "Открыть оригинал",
      url,
    },
    ...nextLinks,
  ];
}

function getPublishedAtForStatus({
  requested,
  previous,
  status,
  now,
}: {
  requested?: string;
  previous?: string | null;
  status: ContentStatus;
  now: string;
}) {
  if (requested) {
    return new Date(requested).toISOString();
  }

  if (status === "published") {
    return previous ?? now;
  }

  return previous ?? now;
}

function isResolvedSourceChannel(
  value: ResolvedSourceChannel | null,
): value is ResolvedSourceChannel {
  return value !== null;
}

function ensureUniqueSlug(items: ContentItem[], preferredSlug: string, itemId?: string) {
  const normalized = preferredSlug.trim();
  if (!normalized) {
    return `import-${randomUUID().slice(0, 8)}`;
  }

  const isTaken = (slug: string) =>
    items.some((item) => item.slug === slug && (!itemId || item.id !== itemId));

  if (!isTaken(normalized)) {
    return normalized;
  }

  let suffix = 2;
  while (isTaken(`${normalized}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalized}-${suffix}`;
}

function chooseDefaultImportedCategoryId() {
  return categories.find((entry) => entry.slug === "analysis")?.id ?? categories[0]?.id ?? "cat-analysis";
}

function chooseDefaultImportedSeriesId(categoryId: string) {
  const preferred = seriesList.find((entry) => entry.slug === "archive-notes");
  if (preferred && preferred.categoryId === categoryId) {
    return preferred.id;
  }

  return seriesList.find((entry) => entry.categoryId === categoryId)?.id ?? null;
}

function deriveThumbnailCover(video: NormalizedYouTubeVideo) {
  if (video.thumbnailUrl) {
    return {
      kind: "image" as const,
      alt: video.title,
      src: video.thumbnailUrl,
      palette: pickPalette(video.externalSourceId),
    };
  }

  return {
    kind: "gradient" as const,
    alt: video.title,
    palette: pickPalette(video.externalSourceId),
  };
}

type ImportSnapshot = {
  excerpt?: string;
  description?: string;
  body?: string;
};

function readImportSnapshot(item: ContentItem): ImportSnapshot {
  const payload = item.sourcePayload;
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const snapshot = (payload as Record<string, unknown>).ingestionSnapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return {};
  }

  const raw = snapshot as Record<string, unknown>;
  return {
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    body: typeof raw.body === "string" ? raw.body : undefined,
  };
}

function mergeImportedTextContent(existing: ContentItem, incoming: NormalizedYouTubeVideo) {
  const snapshot = readImportSnapshot(existing);

  const canReplaceExcerpt =
    !existing.excerpt || (snapshot.excerpt ? existing.excerpt === snapshot.excerpt : true);
  const canReplaceDescription =
    !existing.description ||
    (snapshot.description ? existing.description === snapshot.description : true);
  const canReplaceBody =
    !existing.body || (snapshot.body ? existing.body === snapshot.body : true);

  return {
    excerpt: canReplaceExcerpt ? incoming.excerpt : existing.excerpt,
    description: canReplaceDescription ? incoming.description : existing.description,
    body: canReplaceBody ? incoming.body : existing.body,
  };
}

function buildSourcePayload({
  existing,
  source,
  video,
  syncedAt,
}: {
  existing?: Record<string, unknown> | null;
  source: SourceChannel;
  video: NormalizedYouTubeVideo;
  syncedAt: string;
}) {
  return {
    ...(existing ?? {}),
    ingestion: {
      provider: "youtube_rss",
      sourceSlug: source.slug,
      externalSourceId: video.externalSourceId,
      syncedAt,
      ...(video.sourcePayload.ingestion && typeof video.sourcePayload.ingestion === "object"
        ? (video.sourcePayload.ingestion as Record<string, unknown>)
        : {}),
    },
    ingestionSnapshot: {
      excerpt: video.excerpt,
      description: video.description,
      body: video.body,
      syncedAt,
    },
    raw: (video.sourcePayload.raw as Record<string, unknown> | undefined) ?? null,
  };
}

function summarizeRunStatus({
  createdCount,
  updatedCount,
  skippedCount,
  failedCount,
}: Pick<ImportRun, "createdCount" | "updatedCount" | "skippedCount" | "failedCount">): ImportRun["status"] {
  const successful = createdCount + updatedCount + skippedCount;
  if (failedCount === 0) {
    return "success";
  }

  if (successful > 0) {
    return "partial_success";
  }

  return "failed";
}

async function updateRunRecord(run: ImportRun) {
  const existingRuns = await readLocalFallbackImportRuns();
  const index = existingRuns.findIndex((entry) => entry.id === run.id);

  if (index >= 0) {
    const next = [...existingRuns];
    next[index] = run;
    await writeLocalFallbackImportRuns(next);
    return;
  }

  await writeLocalFallbackImportRuns([...existingRuns, run]);
}

function normalizeCommentBody(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function validateCommentInput(input: CreateCommentInput) {
  const authorDisplay = input.authorDisplay.trim();
  if (authorDisplay.length < 2 || authorDisplay.length > 48) {
    throw new Error("Имя автора должно быть длиной от 2 до 48 символов.");
  }

  if (!input.authorFingerprint.trim()) {
    throw new Error("Temporary identity fingerprint is required.");
  }

  const normalizedBody = normalizeCommentBody(input.body);
  if (normalizedBody.length < 3 || normalizedBody.length > 1200) {
    throw new Error("Комментарий должен быть длиной от 3 до 1200 символов.");
  }

  const linksCount = (normalizedBody.match(/https?:\/\/\S+/gi) ?? []).length;
  if (linksCount > 2) {
    throw new Error("Слишком много ссылок в комментарии. Допустимо не более 2.");
  }

  return {
    authorDisplay,
    body: normalizedBody,
    authorFingerprint: input.authorFingerprint.trim(),
  };
}

function mapModerationStatus(status: CommentStatus) {
  if (status === "approved") return "clean" as const;
  if (status === "pending") return "pending_review" as const;
  return "blocked" as const;
}

export class SeedContentRepository implements ContentRepository {
  async listArchiveItems() {
    const items = await getResolvedItems();
    return sortItemsByDate(
      items.filter((item) => item.status === "published"),
      "newest",
    );
  }

  async listAdminContentItems() {
    const items = await getResolvedItems();
    return sortItemsByDate(items, "newest");
  }

  async getItemBySlug(slug: string) {
    const items = await this.listArchiveItems();
    return items.find((item) => item.slug === slug) ?? null;
  }

  async getAdminItemById(id: string) {
    const items = await this.listAdminContentItems();
    return items.find((item) => item.id === id) ?? null;
  }

  async createManualContentItem(input: CreateManualContentInput) {
    const now = new Date().toISOString();
    const existing = await readLocalFallbackContentItems();

    if (existing.some((item) => item.slug === input.slug)) {
      throw new Error("Слаг уже существует");
    }

    const { category, series } = resolveCategoryAndSeries({
      categorySlug: input.categorySlug,
      seriesSlug: input.seriesSlug,
    });
    const platform = resolvePlatformBySlug(input.platformSlug);

    const itemId = `manual-${randomUUID()}`;
    const manualItem: ContentItem = {
      id: itemId,
      slug: input.slug,
      title: input.title,
      categoryId: category.id,
      seriesId: series?.id ?? null,
      platformId: platform.id,
      sourceType: "manual",
      importStatus: "not_applicable",
      status: input.status,
      moderationStatus: "clean",
      externalSourceId: null,
      contentSourceId: `source-${itemId}`,
      tagIds: [],
      publishedAt: getPublishedAtForStatus({
        requested: input.publishedAt,
        previous: null,
        status: input.status,
        now,
      }),
      createdAt: now,
      updatedAt: now,
      durationMinutes: 0,
      excerpt: input.excerpt,
      description: input.description,
      body: input.body,
      cover: {
        kind: "gradient",
        alt: input.title,
        palette: pickPalette(input.slug),
      },
      links: [
        {
          kind: platform.slug === "youtube" ? "youtube" : "video",
          label: "Открыть оригинал",
          url: ensureValidUrl(input.externalUrl),
        },
      ],
      sourcePayload: null,
      featured: false,
    };

    await writeLocalFallbackContentItems([...existing, manualItem]);

    return {
      id: manualItem.id,
      slug: manualItem.slug,
    };
  }

  async updateContentItem(input: UpdateContentItemInput) {
    const now = new Date().toISOString();
    const existing = await readLocalFallbackContentItems();
    const index = existing.findIndex((item) => item.id === input.id);

    if (index < 0) {
      throw new Error("Запись не найдена");
    }

    const duplicateSlug = existing.find(
      (item) => item.slug === input.slug && item.id !== input.id,
    );
    if (duplicateSlug) {
      throw new Error("Слаг уже используется другой записью");
    }

    const { category, series } = resolveCategoryAndSeries({
      categorySlug: input.categorySlug,
      seriesSlug: input.seriesSlug,
    });
    const platform = resolvePlatformBySlug(input.platformSlug);
    const target = existing[index];

    const updatedItem: ContentItem = {
      ...target,
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      description: input.description,
      body: input.body,
      categoryId: category.id,
      seriesId: series?.id ?? null,
      platformId: platform.id,
      status: input.status,
      publishedAt: getPublishedAtForStatus({
        requested: input.publishedAt,
        previous: target.publishedAt,
        status: input.status,
        now,
      }),
      updatedAt: now,
      links: updatePrimaryLink(target, ensureValidUrl(input.externalUrl)),
    };

    const next = [...existing];
    next[index] = updatedItem;
    await writeLocalFallbackContentItems(next);

    return {
      id: updatedItem.id,
      slug: updatedItem.slug,
    };
  }

  async setContentItemStatus(id: string, status: ContentStatus) {
    const existing = await readLocalFallbackContentItems();
    const index = existing.findIndex((item) => item.id === id);

    if (index < 0) {
      throw new Error("Запись не найдена");
    }

    const now = new Date().toISOString();
    const target = existing[index];
    const next = [...existing];
    next[index] = {
      ...target,
      status,
      updatedAt: now,
      publishedAt:
        status === "published"
          ? target.publishedAt ?? now
          : target.publishedAt ?? now,
    };

    await writeLocalFallbackContentItems(next);

    return { id, status };
  }

  async listSourceChannels() {
    const channels = await readLocalFallbackSourceChannels();
    const platformMap = new Map(platforms.map((platform) => [platform.id, platform]));

    const resolved = channels
      .map((channel): ResolvedSourceChannel | null => {
        const platform = platformMap.get(channel.platformId);
        if (!platform) return null;

        return {
          ...channel,
          isActive: channel.isActive ?? true,
          notes: channel.notes ?? null,
          lastSyncedAt: channel.lastSyncedAt ?? null,
          lastSuccessfulSyncAt: channel.lastSuccessfulSyncAt ?? null,
          lastErrorAt: channel.lastErrorAt ?? null,
          lastErrorMessage: channel.lastErrorMessage ?? null,
          platform,
        };
      })
      .filter(isResolvedSourceChannel);

    return resolved.sort((a, b) => a.title.localeCompare(b.title));
  }

  async createSourceChannel(input: CreateSourceChannelInput) {
    const existing = await readLocalFallbackSourceChannels();
    const now = new Date().toISOString();

    if (existing.some((channel) => channel.slug === input.slug)) {
      throw new Error("Канал с таким slug уже существует");
    }

    const platform = resolvePlatformBySlug(input.platformSlug);

    const sourceUrl = input.sourceUrl?.trim() ? ensureValidUrl(input.sourceUrl) : null;
    const externalChannelId = input.externalChannelId?.trim() || null;
    if (!sourceUrl && !externalChannelId) {
      throw new Error("Укажите URL канала или внешний channel id");
    }

    const channel: SourceChannel = {
      id: `channel-${randomUUID()}`,
      slug: input.slug,
      title: input.title,
      platformId: platform.id,
      externalChannelId,
      sourceUrl,
      isActive: input.isActive,
      notes: input.notes?.trim() || null,
      lastSyncedAt: null,
      lastSuccessfulSyncAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    await writeLocalFallbackSourceChannels([...existing, channel]);

    return {
      id: channel.id,
      slug: channel.slug,
    };
  }

  async runSourceSync(
    sourceId: string,
    options?: {
      trigger?: ImportRunTrigger;
      parentRunId?: string;
      requestKey?: string;
      lockAcquiredAt?: string;
      lockReleasedAt?: string;
    },
  ) {
    const now = new Date().toISOString();
    const sourceChannels = await readLocalFallbackSourceChannels();
    const sourceIndex = sourceChannels.findIndex((channel) => channel.id === sourceId);

    if (sourceIndex < 0) {
      throw new Error("Источник не найден");
    }

    const source = sourceChannels[sourceIndex];
    const run: ImportRun = {
      id: `import-run-${randomUUID()}`,
      sourceChannelId: source.id,
      sourceChannelSlug: source.slug,
      sourceChannelTitle: source.title,
      trigger: options?.trigger ?? "sync_source",
      parentRunId: options?.parentRunId ?? null,
      requestKey: options?.requestKey ?? null,
      status: "running",
      startedAt: now,
      finishedAt: null,
      lockAcquiredAt: options?.lockAcquiredAt ?? null,
      lockReleasedAt: options?.lockReleasedAt ?? null,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errorMessage: null,
      itemResults: [],
    };

    await updateRunRecord(run);

    sourceChannels[sourceIndex] = {
      ...source,
      lastSyncedAt: now,
      lastErrorAt: null,
      lastErrorMessage: null,
      updatedAt: now,
    };
    await writeLocalFallbackSourceChannels(sourceChannels);

    try {
      const sourcePlatform = platforms.find((entry) => entry.id === source.platformId);
      if (!sourcePlatform || sourcePlatform.slug !== "youtube") {
        throw new Error("Ингест поддерживается только для YouTube source channels.");
      }

      const { resolved, videos } = await fetchYouTubeChannelVideos(source);
      const allItems = await readLocalFallbackContentItems();

      const defaultCategoryId = chooseDefaultImportedCategoryId();
      const defaultSeriesId = chooseDefaultImportedSeriesId(defaultCategoryId);
      const itemResults: ImportRunItemResult[] = [];

      for (const video of videos) {
        try {
          const existingIndex = allItems.findIndex(
            (item) =>
              item.sourceType === "imported" && item.externalSourceId === video.externalSourceId,
          );

          if (existingIndex < 0) {
            const itemId = `import-${randomUUID()}`;
            const slug = ensureUniqueSlug(allItems, video.slug);
            const importedItem: ContentItem = {
              id: itemId,
              slug,
              title: video.title,
              excerpt: video.excerpt,
              description: video.description,
              body: video.body,
              categoryId: defaultCategoryId,
              seriesId: defaultSeriesId,
              platformId: source.platformId,
              sourceType: "imported",
              contentSourceId: `source-${itemId}`,
              externalSourceId: video.externalSourceId,
              importStatus: "imported",
              status: DEFAULT_IMPORTED_STATUS,
              moderationStatus: "clean",
              tagIds: [],
              publishedAt: toIso(video.publishedAt),
              createdAt: now,
              updatedAt: now,
              durationMinutes: 0,
              cover: deriveThumbnailCover(video),
              links: [
                {
                  kind: "youtube",
                  label: "Открыть оригинал",
                  url: ensureValidUrl(video.externalUrl),
                },
              ],
              sourcePayload: buildSourcePayload({
                source,
                video,
                syncedAt: now,
              }),
              featured: false,
            };

            allItems.push(importedItem);
            run.createdCount += 1;
            itemResults.push({
              externalSourceId: video.externalSourceId,
              status: "created",
              contentItemId: importedItem.id,
            });
            continue;
          }

          const existing = allItems[existingIndex];
          const mergedText = mergeImportedTextContent(existing, video);
          const nextSlug = ensureUniqueSlug(allItems, video.slug, existing.id);
          const nextPrimaryUrl = ensureValidUrl(video.externalUrl);

          const previousPrimaryLink =
            existing.links.find((link) => link.label === "Открыть оригинал") ?? existing.links[0];
          const shouldUpdate =
            existing.title !== video.title ||
            existing.slug !== nextSlug ||
            existing.publishedAt !== toIso(video.publishedAt) ||
            mergedText.excerpt !== existing.excerpt ||
            mergedText.description !== existing.description ||
            mergedText.body !== existing.body ||
            previousPrimaryLink?.url !== nextPrimaryUrl ||
            existing.importStatus !== "imported";

          if (!shouldUpdate) {
            run.skippedCount += 1;
            itemResults.push({
              externalSourceId: video.externalSourceId,
              status: "skipped_duplicate",
              contentItemId: existing.id,
            });
            continue;
          }

          const updatedItem: ContentItem = {
            ...existing,
            title: video.title,
            slug: nextSlug,
            excerpt: mergedText.excerpt,
            description: mergedText.description,
            body: mergedText.body,
            platformId: source.platformId,
            sourceType: "imported",
            importStatus: "imported",
            publishedAt: toIso(video.publishedAt),
            updatedAt: now,
            cover: deriveThumbnailCover(video),
            links: updatePrimaryLink(existing, nextPrimaryUrl),
            sourcePayload: buildSourcePayload({
              existing: existing.sourcePayload ?? null,
              source,
              video,
              syncedAt: now,
            }),
          };

          allItems[existingIndex] = updatedItem;
          run.updatedCount += 1;
          itemResults.push({
            externalSourceId: video.externalSourceId,
            status: "updated",
            contentItemId: updatedItem.id,
          });
        } catch (error) {
          run.failedCount += 1;
          itemResults.push({
            externalSourceId: video.externalSourceId,
            status: "failed",
            message: error instanceof Error ? error.message : "Unknown ingestion error",
          });
        }
      }

      await writeLocalFallbackContentItems(allItems);

      const finishedAt = new Date().toISOString();
      run.itemResults = itemResults;
      run.status = summarizeRunStatus(run);
      run.finishedAt = finishedAt;
      run.lockReleasedAt = finishedAt;

      const refreshedSourceChannels = await readLocalFallbackSourceChannels();
      const refreshedSourceIndex = refreshedSourceChannels.findIndex(
        (channel) => channel.id === source.id,
      );
      if (refreshedSourceIndex >= 0) {
        refreshedSourceChannels[refreshedSourceIndex] = {
          ...refreshedSourceChannels[refreshedSourceIndex],
          externalChannelId:
            refreshedSourceChannels[refreshedSourceIndex].externalChannelId ??
            resolved.channelId,
          lastSyncedAt: finishedAt,
          lastSuccessfulSyncAt:
            run.status === "success" || run.status === "partial_success"
              ? finishedAt
              : refreshedSourceChannels[refreshedSourceIndex].lastSuccessfulSyncAt ?? null,
          lastErrorAt: run.status === "failed" ? finishedAt : null,
          lastErrorMessage:
            run.status === "failed" ? run.errorMessage ?? "Ingestion failed" : null,
          updatedAt: finishedAt,
        };
        await writeLocalFallbackSourceChannels(refreshedSourceChannels);
      }

      await updateRunRecord(run);
      return run;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Ingestion failed";

      run.status = "failed";
      run.errorMessage = message;
      run.finishedAt = finishedAt;
      run.lockReleasedAt = finishedAt;
      run.failedCount = run.failedCount || 1;
      await updateRunRecord(run);

      const refreshedSourceChannels = await readLocalFallbackSourceChannels();
      const refreshedSourceIndex = refreshedSourceChannels.findIndex(
        (channel) => channel.id === source.id,
      );
      if (refreshedSourceIndex >= 0) {
        refreshedSourceChannels[refreshedSourceIndex] = {
          ...refreshedSourceChannels[refreshedSourceIndex],
          lastSyncedAt: finishedAt,
          lastErrorAt: finishedAt,
          lastErrorMessage: message,
          updatedAt: finishedAt,
        };
        await writeLocalFallbackSourceChannels(refreshedSourceChannels);
      }

      return run;
    }
  }

  async runAllActiveSourceSync(options?: { requestKey?: string }) {
    const channels = await readLocalFallbackSourceChannels();
    const active = channels.filter((channel) => channel.isActive);
    const runs: ImportRun[] = [];

    for (const source of active) {
      const run = await this.runSourceSync(source.id, {
        trigger: "sync_all",
        requestKey: options?.requestKey,
      });
      runs.push(run);
    }

    return runs;
  }

  async getImportRunById(id: string) {
    const runs = await readLocalFallbackImportRuns();
    return runs.find((run) => run.id === id) ?? null;
  }

  async listImportRuns(limit = 20) {
    const runs = await readLocalFallbackImportRuns();
    const sorted = [...runs].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return sorted.slice(0, limit);
  }

  async listCommentsForContentItem(
    contentItemId: string,
    options?: { statuses?: CommentStatus[] },
  ) {
    const comments = await readLocalFallbackComments();
    const allowedStatuses = options?.statuses;

    return comments
      .filter((comment) => {
        if (comment.contentItemId !== contentItemId) return false;
        if (!allowedStatuses || allowedStatuses.length === 0) return true;
        return allowedStatuses.includes(comment.status);
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  async createComment(input: CreateCommentInput) {
    const items = await readLocalFallbackContentItems();
    const targetItem = items.find((item) => item.id === input.contentItemId);
    if (!targetItem) {
      throw new Error("Контент для комментария не найден.");
    }

    const parsed = validateCommentInput(input);
    const now = new Date().toISOString();
    const comments = await readLocalFallbackComments();

    const recentComment = comments.find(
      (comment) =>
        comment.contentItemId === input.contentItemId &&
        comment.authorFingerprint === parsed.authorFingerprint &&
        new Date(now).getTime() - new Date(comment.createdAt).getTime() < 15_000,
    );

    if (recentComment) {
      throw new Error("Слишком частая отправка. Подождите несколько секунд.");
    }

    const comment: CommentRecord = {
      id: `comment-${randomUUID()}`,
      contentItemId: input.contentItemId,
      parentId: null,
      identityMode: input.identityMode,
      authorUserId: input.authorUserId ?? null,
      authorDisplay: parsed.authorDisplay,
      authorFingerprint: parsed.authorFingerprint,
      body: parsed.body,
      status: "pending",
      moderationStatus: "pending_review",
      moderationReason: "Ожидает первичной модерации.",
      createdAt: now,
      updatedAt: now,
    };

    await writeLocalFallbackComments([...comments, comment]);
    return comment;
  }

  async setCommentModeration(input: UpdateCommentModerationInput) {
    const comments = await readLocalFallbackComments();
    const index = comments.findIndex((comment) => comment.id === input.commentId);
    if (index < 0) {
      throw new Error("Комментарий не найден.");
    }

    const now = new Date().toISOString();
    const current = comments[index];
    const updated: CommentRecord = {
      ...current,
      status: input.status,
      moderationStatus: mapModerationStatus(input.status),
      moderationReason: input.moderationReason?.trim() || null,
      updatedAt: now,
    };

    const next = [...comments];
    next[index] = updated;
    await writeLocalFallbackComments(next);
    return updated;
  }

  async listModerationComments(filters?: {
    status?: CommentStatus | "all";
    q?: string;
    limit?: number;
  }) {
    const comments = await readLocalFallbackComments();
    const status = filters?.status ?? "all";
    const q = (filters?.q ?? "").trim().toLowerCase();
    const limit = filters?.limit ?? 150;

    return comments
      .filter((comment) => {
        const matchesStatus = status === "all" || comment.status === status;
        if (!matchesStatus) return false;
        if (!q) return true;

        const searchable = [
          comment.id,
          comment.contentItemId,
          comment.authorDisplay,
          comment.body,
          comment.status,
          comment.moderationStatus,
          comment.moderationReason ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  async listReactionsForContentItem(contentItemId: string) {
    const reactions = await readLocalFallbackReactions();
    return reactions.filter((reaction) => reaction.contentItemId === contentItemId);
  }

  async upsertReaction(input: UpsertReactionInput): Promise<UpsertReactionResult> {
    if (!input.actorFingerprint.trim()) {
      throw new Error("Temporary identity fingerprint is required for reactions.");
    }

    const now = new Date().toISOString();
    const reactions = await readLocalFallbackReactions();
    const matchesActor = (reaction: ReactionRecord) =>
      reaction.contentItemId === input.contentItemId &&
      ((input.actorUserId && reaction.actorUserId === input.actorUserId) ||
        reaction.actorFingerprint === input.actorFingerprint);
    const actorReactions = reactions.filter(
      (reaction) => matchesActor(reaction),
    );

    const hasSameReaction = actorReactions.some(
      (reaction) => reaction.reactionType === input.reactionType,
    );

    if (hasSameReaction) {
      const next = reactions.filter(
        (reaction) => !matchesActor(reaction),
      );
      await writeLocalFallbackReactions(next);
      return {
        action: "removed",
        reaction: null,
      };
    }

    const withoutActorReactions = reactions.filter(
      (reaction) => !matchesActor(reaction),
    );

    const reaction: ReactionRecord = {
      id: `reaction-${randomUUID()}`,
      contentItemId: input.contentItemId,
      reactionType: input.reactionType,
      actorUserId: input.actorUserId ?? null,
      actorFingerprint: input.actorFingerprint,
      createdAt: now,
    };

    await writeLocalFallbackReactions([...withoutActorReactions, reaction]);
    return {
      action: actorReactions.length > 0 ? "updated" : "created",
      reaction,
    };
  }

  async listTaxonomy() {
    return {
      categories,
      series: seriesList,
      platforms,
      tags,
    };
  }
}
