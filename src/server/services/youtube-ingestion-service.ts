import "server-only";

import { sanitizeSlug } from "@/lib/slug";
import type { SourceChannel } from "@/types/content";

type ChannelIdResolutionStrategy =
  | "external_channel_id"
  | "source_url"
  | "handle_lookup";

export interface ResolvedYouTubeSource {
  channelId: string;
  handle?: string;
  feedUrl: string;
  strategy: ChannelIdResolutionStrategy;
}

export interface NormalizedYouTubeVideo {
  externalSourceId: string;
  title: string;
  slug: string;
  publishedAt: string;
  externalUrl: string;
  excerpt: string;
  description: string;
  body: string;
  thumbnailUrl?: string;
  sourceTags: string[];
  sourceCategory: string | null;
  sourceChannelId: string | null;
  sourceChannelTitle: string | null;
  sourcePayload: Record<string, unknown>;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_WATCH_ENRICHMENT_TIMEOUT_MS = 12000;
const DEFAULT_OEMBED_ENRICHMENT_TIMEOUT_MS = 8000;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_EXCERPT_LENGTH = 260;

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

async function fetchText(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const timer = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ORKPOD-Archive-Ingestion/1.0; +https://orkpod.local)",
        Accept: "application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
      signal: timer.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    timer.clear();
  }
}

async function fetchJson<T>(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<T> {
  const timer = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ORKPOD-Archive-Ingestion/1.0; +https://orkpod.local)",
        Accept: "application/json, text/plain;q=0.8, */*;q=0.7",
      },
      cache: "no-store",
      signal: timer.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    timer.clear();
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return decodeHtmlEntities(stripHtml(value)).trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function extractFirstMatch(source: string, expression: RegExp) {
  const match = source.match(expression);
  return match?.[1]?.trim() ?? null;
}

function deduplicateCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of values) {
    const normalized = entry.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function parseJsonEscapedString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function parseMetaContent(html: string, key: string, attribute: "name" | "property") {
  const expression = new RegExp(
    `<meta[^>]*${attribute}=(?:"|')${key}(?:"|')[^>]*content=(?:"|')([^"']+)(?:"|')[^>]*>`,
    "i",
  );
  return extractFirstMatch(html, expression);
}

function extractYouTubeChannelIdFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(/\/channel\/(UC[\w-]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractYouTubeHandleFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(/\/(@[\w.-]+)/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function normalizeHandle(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("@")) {
    return trimmed.toLowerCase();
  }

  if (/^[a-z0-9._-]+$/i.test(trimmed)) {
    return `@${trimmed.toLowerCase()}`;
  }

  return null;
}

function extractChannelIdFromHtml(html: string) {
  const channelIdFromJson = extractFirstMatch(html, /"channelId":"(UC[\w-]+)"/i);
  if (channelIdFromJson) {
    return channelIdFromJson;
  }

  const canonicalChannel = extractFirstMatch(
    html,
    /https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)/i,
  );
  if (canonicalChannel) {
    return canonicalChannel;
  }

  return null;
}

async function resolveChannelIdByHandle(handle: string) {
  const html = await fetchText(`https://www.youtube.com/${handle}/videos`);
  return extractChannelIdFromHtml(html);
}

export async function resolveYouTubeSourceChannel(
  source: SourceChannel,
): Promise<ResolvedYouTubeSource> {
  const directExternalId = source.externalChannelId?.trim() ?? "";
  if (directExternalId.startsWith("UC")) {
    return {
      channelId: directExternalId,
      feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${directExternalId}`,
      strategy: "external_channel_id",
    };
  }

  const channelIdFromSourceUrl = extractYouTubeChannelIdFromUrl(source.sourceUrl);
  if (channelIdFromSourceUrl) {
    return {
      channelId: channelIdFromSourceUrl,
      feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdFromSourceUrl}`,
      strategy: "source_url",
    };
  }

  const candidateHandle =
    normalizeHandle(directExternalId) ??
    extractYouTubeHandleFromUrl(source.sourceUrl) ??
    normalizeHandle(source.slug);

  if (!candidateHandle) {
    throw new Error(
      `Cannot resolve YouTube channel for "${source.slug}". Specify external_channel_id (UC...) or source URL.`,
    );
  }

  const resolvedChannelId = await resolveChannelIdByHandle(candidateHandle);
  if (!resolvedChannelId) {
    throw new Error(
      `Cannot resolve channel_id for "${source.slug}" from handle ${candidateHandle}.`,
    );
  }

  return {
    channelId: resolvedChannelId,
    handle: candidateHandle,
    feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${resolvedChannelId}`,
    strategy: "handle_lookup",
  };
}

function parseFeedEntries(xml: string) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gim)];
  return entries.map((entry) => entry[1]);
}

function parseLinkUrl(entryXml: string) {
  const linkMatch = entryXml.match(
    /<link[^>]*rel=(?:"|')alternate(?:"|')[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*\/?>/i,
  );
  return linkMatch?.[1] ?? null;
}

function parseThumbnailUrl(entryXml: string) {
  const thumbnailMatch = entryXml.match(
    /<media:thumbnail[^>]*url=(?:"|')([^"']+)(?:"|')[^>]*\/?>/i,
  );
  return thumbnailMatch?.[1] ?? null;
}

function parseFeedCategoryTerms(entryXml: string) {
  const entries = [...entryXml.matchAll(/<category[^>]*term=(?:"|')([^"']+)(?:"|')[^>]*\/?>/gi)];
  const values = entries
    .map((entry) => normalizeText(entry[1] ?? ""))
    .filter((entry) => entry.length > 1)
    .filter((entry) => !entry.toLowerCase().startsWith("http"));

  return deduplicateCaseInsensitive(values);
}

function toIsoDate(value: string | null) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeVideoFromFeedEntry(entryXml: string, sourceSlug: string) {
  const videoId = extractFirstMatch(entryXml, /<yt:videoId>([^<]+)<\/yt:videoId>/i);
  if (!videoId) {
    return null;
  }

  const titleRaw = extractFirstMatch(entryXml, /<title>([\s\S]*?)<\/title>/i) ?? videoId;
  const descriptionRaw =
    extractFirstMatch(entryXml, /<media:description>([\s\S]*?)<\/media:description>/i) ??
    extractFirstMatch(entryXml, /<content[^>]*>([\s\S]*?)<\/content>/i) ??
    "";
  const linkUrl = parseLinkUrl(entryXml) ?? `https://www.youtube.com/watch?v=${videoId}`;
  const thumbnailUrl = parseThumbnailUrl(entryXml) ?? undefined;
  const feedCategoryTerms = parseFeedCategoryTerms(entryXml);
  const sourceChannelTitle =
    normalizeText(extractFirstMatch(entryXml, /<author>\s*<name>([^<]+)<\/name>/i) ?? "") || null;
  const sourceChannelId = extractFirstMatch(entryXml, /<yt:channelId>([^<]+)<\/yt:channelId>/i);

  const title = normalizeText(titleRaw);
  const description = truncate(normalizeText(descriptionRaw), MAX_DESCRIPTION_LENGTH);
  const excerptSource = description || title;
  const excerpt = truncate(excerptSource, MAX_EXCERPT_LENGTH);
  const publishedAt = toIsoDate(
    extractFirstMatch(entryXml, /<published>([^<]+)<\/published>/i) ??
      extractFirstMatch(entryXml, /<updated>([^<]+)<\/updated>/i),
  );

  const baseSlug =
    sanitizeSlug(`${sourceSlug}-${title}`) || sanitizeSlug(`${sourceSlug}-${videoId}`);
  const slug = sanitizeSlug(`${baseSlug}-${videoId.slice(0, 8)}`);

  return {
    externalSourceId: videoId,
    title: title || videoId,
    slug,
    publishedAt,
    externalUrl: linkUrl,
    excerpt,
    description,
    body: description,
    thumbnailUrl,
    sourceTags: feedCategoryTerms,
    sourceCategory: feedCategoryTerms[0] ?? null,
    sourceChannelId: sourceChannelId ?? null,
    sourceChannelTitle,
    sourcePayload: {
      ingestion: {
        provider: "youtube_rss",
        importedFromFeed: true,
        metadataSources: ["feed"],
      },
      raw: {
        entryXml,
      },
    },
  } satisfies NormalizedYouTubeVideo;
}

type WatchMetadata = {
  description: string | null;
  keywords: string[];
  category: string | null;
  thumbnailUrl: string | null;
  channelId: string | null;
  channelTitle: string | null;
};

type OEmbedMetadata = {
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  channelId: string | null;
  channelHandle: string | null;
};

type ReliabilityLevel = "high" | "medium" | "low";

function parseWatchMetadata(html: string): WatchMetadata {
  const shortDescriptionToken = extractFirstMatch(
    html,
    /"shortDescription":"((?:\\.|[^"\\])*)"/i,
  );
  const shortDescription = shortDescriptionToken
    ? normalizeText(parseJsonEscapedString(shortDescriptionToken))
    : null;
  const metaDescription = normalizeText(parseMetaContent(html, "description", "name") ?? "");
  const description =
    [shortDescription, metaDescription]
      .filter((entry): entry is string => Boolean(entry))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const keywordToken = extractFirstMatch(html, /"keywords":"((?:\\.|[^"\\])*)"/i);
  const keywordArrayToken = extractFirstMatch(html, /"keywords":\[((?:\\.|[^\]])*)\]/i);
  const keywordMeta = normalizeText(parseMetaContent(html, "keywords", "name") ?? "");
  const keywordsFromArray = (() => {
    if (!keywordArrayToken) {
      return [] as string[];
    }

    try {
      const parsed = JSON.parse(`[${keywordArrayToken}]`) as unknown[];
      return parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
      return [] as string[];
    }
  })();

  const keywords = deduplicateCaseInsensitive([
    ...keywordsFromArray,
    ...(keywordToken ? parseJsonEscapedString(keywordToken).split(",") : []),
    ...keywordMeta.split(","),
  ]
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 1));

  const categoryToken = extractFirstMatch(html, /"category":"((?:\\.|[^"\\])*)"/i);
  const channelTitleToken =
    extractFirstMatch(html, /"ownerChannelName":"((?:\\.|[^"\\])*)"/i) ??
    extractFirstMatch(html, /"author":"((?:\\.|[^"\\])*)"/i);
  const thumbnailUrl =
    parseMetaContent(html, "og:image", "property") ??
    parseMetaContent(html, "twitter:image", "name");

  return {
    description: description ? truncate(description, MAX_DESCRIPTION_LENGTH) : null,
    keywords,
    category: categoryToken ? normalizeText(parseJsonEscapedString(categoryToken)) : null,
    thumbnailUrl: thumbnailUrl ? normalizeText(thumbnailUrl) : null,
    channelId: extractChannelIdFromHtml(html),
    channelTitle: channelTitleToken
      ? normalizeText(parseJsonEscapedString(channelTitleToken))
      : null,
  };
}

function parseOEmbedMetadata(value: Record<string, unknown>): OEmbedMetadata {
  const authorUrl = typeof value.author_url === "string" ? value.author_url : null;

  return {
    title:
      typeof value.title === "string" && normalizeText(value.title)
        ? normalizeText(value.title)
        : null,
    authorName:
      typeof value.author_name === "string" && normalizeText(value.author_name)
        ? normalizeText(value.author_name)
        : null,
    authorUrl,
    thumbnailUrl:
      typeof value.thumbnail_url === "string" && normalizeText(value.thumbnail_url)
        ? normalizeText(value.thumbnail_url)
        : null,
    channelId: extractYouTubeChannelIdFromUrl(authorUrl),
    channelHandle: extractYouTubeHandleFromUrl(authorUrl),
  };
}

function isWatchEnrichmentEnabled() {
  const raw = (process.env.YOUTUBE_INGESTION_ENABLE_WATCH_ENRICHMENT ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function getWatchEnrichmentTimeoutMs() {
  const raw = Number.parseInt(
    process.env.YOUTUBE_INGESTION_WATCH_TIMEOUT_MS ?? `${DEFAULT_WATCH_ENRICHMENT_TIMEOUT_MS}`,
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WATCH_ENRICHMENT_TIMEOUT_MS;
}

function isOEmbedEnrichmentEnabled() {
  const raw = (process.env.YOUTUBE_INGESTION_ENABLE_OEMBED_ENRICHMENT ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function getOEmbedEnrichmentTimeoutMs() {
  const raw = Number.parseInt(
    process.env.YOUTUBE_INGESTION_OEMBED_TIMEOUT_MS ?? `${DEFAULT_OEMBED_ENRICHMENT_TIMEOUT_MS}`,
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OEMBED_ENRICHMENT_TIMEOUT_MS;
}

function normalizeReliabilityLevel(score: number): ReliabilityLevel {
  if (score >= 8) {
    return "high";
  }
  if (score >= 5) {
    return "medium";
  }
  return "low";
}

function reliabilityLevelToScore(level: ReliabilityLevel) {
  if (level === "high") {
    return 2;
  }
  if (level === "medium") {
    return 1;
  }
  return 0;
}

function mergeDescription(feedDescription: string, watchDescription: string | null) {
  const normalizedFeed = normalizeText(feedDescription);
  const normalizedWatch = watchDescription ? normalizeText(watchDescription) : "";

  if (!normalizedWatch) {
    return {
      description: normalizedFeed,
      usedWatchDescription: false,
    };
  }

  if (normalizedWatch.length >= normalizedFeed.length + 24) {
    return {
      description: truncate(normalizedWatch, MAX_DESCRIPTION_LENGTH),
      usedWatchDescription: true,
    };
  }

  return {
    description: truncate(normalizedFeed, MAX_DESCRIPTION_LENGTH),
    usedWatchDescription: false,
  };
}

async function enrichVideoFromAdditionalSources(video: NormalizedYouTubeVideo) {
  const watchUrl = `https://www.youtube.com/watch?v=${video.externalSourceId}`;

  const [watchResult, oEmbedResult] = await Promise.all([
    (async () => {
      if (!isWatchEnrichmentEnabled()) {
        return {
          metadata: null as WatchMetadata | null,
          error: null as string | null,
          enabled: false,
        };
      }

      try {
        const html = await fetchText(watchUrl, getWatchEnrichmentTimeoutMs());
        return {
          metadata: parseWatchMetadata(html),
          error: null,
          enabled: true,
        };
      } catch (error) {
        return {
          metadata: null,
          error: error instanceof Error ? error.message : "unknown_watch_enrichment_error",
          enabled: true,
        };
      }
    })(),
    (async () => {
      if (!isOEmbedEnrichmentEnabled()) {
        return {
          metadata: null as OEmbedMetadata | null,
          error: null as string | null,
          enabled: false,
        };
      }

      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`;
        const raw = await fetchJson<Record<string, unknown>>(
          oEmbedUrl,
          getOEmbedEnrichmentTimeoutMs(),
        );
        return {
          metadata: parseOEmbedMetadata(raw),
          error: null,
          enabled: true,
        };
      } catch (error) {
        return {
          metadata: null,
          error: error instanceof Error ? error.message : "unknown_oembed_error",
          enabled: true,
        };
      }
    })(),
  ]);

  const watchMetadata = watchResult.metadata;
  const oEmbedMetadata = oEmbedResult.metadata;
  const mergedDescription = mergeDescription(video.description, watchMetadata?.description ?? null);
  const description = mergedDescription.description;

  const resolvedTitle =
    normalizeText(oEmbedMetadata?.title ?? "") || normalizeText(video.title) || video.externalSourceId;
  const resolvedThumbnail =
    oEmbedMetadata?.thumbnailUrl ?? watchMetadata?.thumbnailUrl ?? video.thumbnailUrl;
  const resolvedTags = deduplicateCaseInsensitive([
    ...video.sourceTags,
    ...(watchMetadata?.keywords ?? []),
  ]);
  const resolvedCategory = watchMetadata?.category ?? video.sourceCategory;
  const resolvedChannelId =
    watchMetadata?.channelId ?? oEmbedMetadata?.channelId ?? video.sourceChannelId;
  const resolvedChannelTitle =
    oEmbedMetadata?.authorName ?? watchMetadata?.channelTitle ?? video.sourceChannelTitle;
  const excerpt = truncate(description || resolvedTitle, MAX_EXCERPT_LENGTH);

  const metadataSources = deduplicateCaseInsensitive([
    "feed",
    watchMetadata ? "watch_page" : "",
    oEmbedMetadata ? "oembed" : "",
  ].filter(Boolean));

  const titleReliability = oEmbedMetadata?.title
    ? ({ level: "high", source: "oembed", present: true } as const)
    : resolvedTitle && resolvedTitle !== video.externalSourceId
      ? ({ level: "medium", source: "feed", present: true } as const)
      : ({ level: "low", source: "video_id_fallback", present: false } as const);

  const descriptionReliability = mergedDescription.usedWatchDescription
    ? ({ level: "medium", source: "watch_page", present: true } as const)
    : description
      ? ({ level: "low", source: "feed", present: true } as const)
      : ({ level: "low", source: "missing", present: false } as const);

  const thumbnailReliability = oEmbedMetadata?.thumbnailUrl
    ? ({ level: "high", source: "oembed", present: true } as const)
    : watchMetadata?.thumbnailUrl || video.thumbnailUrl
      ? ({
          level: "medium",
          source: watchMetadata?.thumbnailUrl ? "watch_page" : "feed",
          present: true,
        } as const)
      : ({ level: "low", source: "missing", present: false } as const);

  const sourceTagsReliability =
    resolvedTags.length >= 3 && (watchMetadata?.keywords.length ?? 0) > 0
      ? ({ level: "medium", source: "feed+watch_page", present: true } as const)
      : resolvedTags.length > 0
        ? ({ level: "low", source: "feed_or_watch_page", present: true } as const)
        : ({ level: "low", source: "missing", present: false } as const);

  const sourceCategoryReliability = resolvedCategory
    ? ({
        level: watchMetadata?.category ? "medium" : "low",
        source: watchMetadata?.category ? "watch_page" : "feed",
        present: true,
      } as const)
    : ({ level: "low", source: "missing", present: false } as const);

  const channelIdentityReliability =
    resolvedChannelId && resolvedChannelTitle
      ? ({
          level: oEmbedMetadata?.authorName || watchMetadata?.channelId ? "high" : "medium",
          source: oEmbedMetadata?.authorName
            ? "oembed"
            : watchMetadata?.channelId
              ? "watch_page"
              : "feed",
          present: true,
        } as const)
      : resolvedChannelId || resolvedChannelTitle
        ? ({ level: "medium", source: "partial", present: true } as const)
        : ({ level: "low", source: "missing", present: false } as const);

  const externalUrlReliability = { level: "high", source: "youtube_video_id", present: true } as const;

  const missingCriticalFields = [
    !resolvedTitle || resolvedTitle === video.externalSourceId ? "title" : "",
    !description ? "description" : "",
    !resolvedThumbnail ? "thumbnail" : "",
    !resolvedChannelId ? "channel_id" : "",
    !resolvedChannelTitle ? "channel_title" : "",
  ].filter(Boolean);

  const reliabilityScore =
    reliabilityLevelToScore(titleReliability.level) +
    reliabilityLevelToScore(descriptionReliability.level) +
    reliabilityLevelToScore(thumbnailReliability.level) +
    reliabilityLevelToScore(channelIdentityReliability.level) +
    reliabilityLevelToScore(externalUrlReliability.level);

  return {
    ...video,
    title: resolvedTitle,
    description,
    excerpt,
    body: description,
    externalUrl: watchUrl,
    thumbnailUrl: resolvedThumbnail,
    sourceTags: resolvedTags,
    sourceCategory: resolvedCategory,
    sourceChannelId: resolvedChannelId,
    sourceChannelTitle: resolvedChannelTitle,
    sourcePayload: {
      ...video.sourcePayload,
      ingestion: {
        ...(video.sourcePayload.ingestion as Record<string, unknown> | undefined),
        provider: "youtube_rss_multi_source_enriched",
        watchEnriched: Boolean(watchMetadata),
        oembedEnriched: Boolean(oEmbedMetadata),
        usedWatchDescription: mergedDescription.usedWatchDescription,
        metadataSources,
        watchEnrichmentError: watchResult.error,
        oembedEnrichmentError: oEmbedResult.error,
        metadataQuality: {
          overallReliability: normalizeReliabilityLevel(reliabilityScore),
          missingCriticalFields,
          fieldReliability: {
            title: titleReliability,
            description: descriptionReliability,
            thumbnail: thumbnailReliability,
            sourceTags: sourceTagsReliability,
            sourceCategory: sourceCategoryReliability,
            channelIdentity: channelIdentityReliability,
            externalUrl: externalUrlReliability,
          },
        },
      },
      watchMetadata: watchMetadata
        ? {
            keywordCount: watchMetadata.keywords.length,
            category: watchMetadata.category,
            channelId: watchMetadata.channelId,
            channelTitle: watchMetadata.channelTitle,
            thumbnailUrl: watchMetadata.thumbnailUrl,
          }
        : null,
      oEmbedMetadata: oEmbedMetadata
        ? {
            title: oEmbedMetadata.title,
            authorName: oEmbedMetadata.authorName,
            authorUrl: oEmbedMetadata.authorUrl,
            channelId: oEmbedMetadata.channelId,
            channelHandle: oEmbedMetadata.channelHandle,
            thumbnailUrl: oEmbedMetadata.thumbnailUrl,
          }
        : null,
    },
  } satisfies NormalizedYouTubeVideo;
}

export async function fetchYouTubeChannelVideos(
  source: SourceChannel,
  options?: {
    maxItems?: number;
  },
) {
  const resolved = await resolveYouTubeSourceChannel(source);
  const xml = await fetchText(resolved.feedUrl);
  const maxItems =
    options?.maxItems ??
    Number.parseInt(process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE ?? "15", 10);

  const videos: NormalizedYouTubeVideo[] = [];
  const normalizedLimit = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 15;

  for (const entryXml of parseFeedEntries(xml)) {
    const normalized = normalizeVideoFromFeedEntry(entryXml, source.slug);
    if (!normalized) {
      continue;
    }

    videos.push(normalized);
    if (videos.length >= normalizedLimit) {
      break;
    }
  }

  const enriched = isWatchEnrichmentEnabled()
    ? await Promise.all(videos.map((video) => enrichVideoFromAdditionalSources(video)))
    : isOEmbedEnrichmentEnabled()
      ? await Promise.all(videos.map((video) => enrichVideoFromAdditionalSources(video)))
      : videos;

  return {
    resolved,
    videos: enriched.map((video) => ({
      ...video,
      sourceChannelId: video.sourceChannelId ?? resolved.channelId,
      sourcePayload: {
        ...video.sourcePayload,
        ingestion: {
          ...(video.sourcePayload.ingestion as Record<string, unknown> | undefined),
          resolvedChannelId: resolved.channelId,
          sourceHandle: resolved.handle ?? null,
          sourceResolutionStrategy: resolved.strategy,
        },
      },
    })),
  };
}
