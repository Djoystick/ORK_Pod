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
const DEFAULT_YOUTUBE_DATA_API_TIMEOUT_MS = 12000;
const DEFAULT_YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS = 120;
const DEFAULT_YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE = 50;
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

function isValidYouTubeChannelId(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^UC[\w-]{22}$/.test(value.trim());
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
  if (isValidYouTubeChannelId(directExternalId)) {
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

  const canUseExternalIdAsHandle =
    directExternalId.startsWith("@") || !directExternalId.toUpperCase().startsWith("UC");
  const externalHandleCandidate = canUseExternalIdAsHandle
    ? normalizeHandle(directExternalId)
    : null;
  const candidateHandle =
    extractYouTubeHandleFromUrl(source.sourceUrl) ??
    externalHandleCandidate ??
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

type YouTubeDataApiVideoMetadata = {
  title: string | null;
  description: string | null;
  tags: string[];
  categoryId: string | null;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
};

type YouTubeDataApiFetchResult = {
  enabled: boolean;
  used: boolean;
  error: string | null;
  videosById: Map<string, YouTubeDataApiVideoMetadata>;
};

type YouTubeDataApiPlaylistVideoSeed = {
  videoId: string;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  channelId: string | null;
  channelTitle: string | null;
};

type YouTubeDataApiPrimaryPathResult = {
  videos: NormalizedYouTubeVideo[];
  dataApiResult: YouTubeDataApiFetchResult;
  telemetry: {
    attempted: boolean;
    used: boolean;
    requestedMaxItems: number;
    collectedItems: number;
    pagesFetched: number;
    hasMore: boolean;
    nextPageToken: string | null;
    uploadsPlaylistId: string | null;
    channelTitle: string | null;
    error: string | null;
  };
};

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

function getYouTubeDataApiKey() {
  return (process.env.YOUTUBE_DATA_API_KEY ?? "").trim();
}

function isYouTubeDataApiEnabled() {
  return getYouTubeDataApiKey().length > 0;
}

function getYouTubeDataApiTimeoutMs() {
  const raw = Number.parseInt(
    process.env.YOUTUBE_DATA_API_TIMEOUT_MS ?? `${DEFAULT_YOUTUBE_DATA_API_TIMEOUT_MS}`,
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_YOUTUBE_DATA_API_TIMEOUT_MS;
}

function isYouTubeDataApiPrimaryPathEnabled() {
  const raw = (process.env.YOUTUBE_DATA_API_PREFER_PRIMARY ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function getYouTubeDataApiBackfillMaxItems(requestedMaxItems?: number) {
  const raw =
    requestedMaxItems ??
    Number.parseInt(
      process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE ??
        `${DEFAULT_YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS}`,
      10,
    );
  const normalized = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS;
  return Math.max(1, Math.min(500, normalized));
}

function getYouTubeDataApiBackfillPageSize() {
  const raw = Number.parseInt(
    process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE ??
      `${DEFAULT_YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE}`,
    10,
  );
  const normalized = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE;
  return Math.max(5, Math.min(50, normalized));
}

function parseYouTubeDataApiThumbnail(snippet: Record<string, unknown>) {
  const thumbnails =
    snippet.thumbnails && typeof snippet.thumbnails === "object"
      ? (snippet.thumbnails as Record<string, unknown>)
      : null;
  if (!thumbnails) {
    return null;
  }

  const preferenceOrder = ["maxres", "standard", "high", "medium", "default"];
  for (const key of preferenceOrder) {
    const entry = thumbnails[key];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const url = (entry as Record<string, unknown>).url;
    if (typeof url === "string" && normalizeText(url)) {
      return normalizeText(url);
    }
  }

  return null;
}

async function fetchYouTubeDataApiVideoMetadata(
  videoIds: string[],
): Promise<YouTubeDataApiFetchResult> {
  const normalizedVideoIds = deduplicateCaseInsensitive(videoIds).filter(Boolean);
  if (!isYouTubeDataApiEnabled() || normalizedVideoIds.length === 0) {
    return {
      enabled: false,
      used: false,
      error: null,
      videosById: new Map<string, YouTubeDataApiVideoMetadata>(),
    };
  }

  const apiKey = getYouTubeDataApiKey();
  const videosById = new Map<string, YouTubeDataApiVideoMetadata>();

  try {
    for (let index = 0; index < normalizedVideoIds.length; index += 50) {
      const chunk = normalizedVideoIds.slice(index, index + 50);
      if (chunk.length === 0) {
        continue;
      }

      const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
      endpoint.searchParams.set("part", "snippet");
      endpoint.searchParams.set("id", chunk.join(","));
      endpoint.searchParams.set("maxResults", "50");
      endpoint.searchParams.set("key", apiKey);

      const payload = await fetchJson<Record<string, unknown>>(
        endpoint.toString(),
        getYouTubeDataApiTimeoutMs(),
      );
      const items = Array.isArray(payload.items)
        ? payload.items.filter(
            (entry): entry is Record<string, unknown> =>
              typeof entry === "object" && entry !== null,
          )
        : [];

      for (const item of items) {
        const videoId = typeof item.id === "string" ? item.id : null;
        if (!videoId) {
          continue;
        }

        const snippet =
          item.snippet && typeof item.snippet === "object"
            ? (item.snippet as Record<string, unknown>)
            : null;
        if (!snippet) {
          continue;
        }

        const rawTags = Array.isArray(snippet.tags)
          ? snippet.tags.filter((entry): entry is string => typeof entry === "string")
          : [];

        videosById.set(videoId, {
          title:
            typeof snippet.title === "string" && normalizeText(snippet.title)
              ? normalizeText(snippet.title)
              : null,
          description:
            typeof snippet.description === "string" && normalizeText(snippet.description)
              ? truncate(normalizeText(snippet.description), MAX_DESCRIPTION_LENGTH)
              : null,
          tags: deduplicateCaseInsensitive(rawTags.map((entry) => normalizeText(entry))),
          categoryId: typeof snippet.categoryId === "string" ? snippet.categoryId : null,
          channelId: typeof snippet.channelId === "string" ? snippet.channelId : null,
          channelTitle:
            typeof snippet.channelTitle === "string" && normalizeText(snippet.channelTitle)
              ? normalizeText(snippet.channelTitle)
              : null,
          publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
          thumbnailUrl: parseYouTubeDataApiThumbnail(snippet),
        });
      }
    }

    return {
      enabled: true,
      used: videosById.size > 0,
      error: null,
      videosById,
    };
  } catch (error) {
    return {
      enabled: true,
      used: false,
      error: error instanceof Error ? error.message : "youtube_data_api_error",
      videosById: new Map<string, YouTubeDataApiVideoMetadata>(),
    };
  }
}

async function fetchYouTubeDataApiUploadsPlaylistInfo(channelId: string) {
  if (!isYouTubeDataApiEnabled()) {
    throw new Error("YouTube Data API key is not configured.");
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
  endpoint.searchParams.set("part", "contentDetails,snippet");
  endpoint.searchParams.set("id", channelId);
  endpoint.searchParams.set("maxResults", "1");
  endpoint.searchParams.set("key", getYouTubeDataApiKey());

  const payload = await fetchJson<Record<string, unknown>>(
    endpoint.toString(),
    getYouTubeDataApiTimeoutMs(),
  );
  const items = Array.isArray(payload.items)
    ? payload.items.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  const first = items[0];
  if (!first) {
    throw new Error(`No channel metadata returned by YouTube Data API for channel ${channelId}.`);
  }

  const contentDetails =
    first.contentDetails && typeof first.contentDetails === "object"
      ? (first.contentDetails as Record<string, unknown>)
      : null;
  const relatedPlaylists =
    contentDetails?.relatedPlaylists && typeof contentDetails.relatedPlaylists === "object"
      ? (contentDetails.relatedPlaylists as Record<string, unknown>)
      : null;
  const uploadsPlaylistId =
    typeof relatedPlaylists?.uploads === "string" && relatedPlaylists.uploads.trim().length > 0
      ? relatedPlaylists.uploads.trim()
      : null;
  const snippet =
    first.snippet && typeof first.snippet === "object"
      ? (first.snippet as Record<string, unknown>)
      : null;
  const channelTitle =
    typeof snippet?.title === "string" && normalizeText(snippet.title)
      ? normalizeText(snippet.title)
      : null;

  if (!uploadsPlaylistId) {
    throw new Error(
      `YouTube Data API did not return uploads playlist id for channel ${channelId}.`,
    );
  }

  return {
    uploadsPlaylistId,
    channelTitle,
  };
}

function parseYouTubeDataApiPlaylistSeed(
  item: Record<string, unknown>,
): YouTubeDataApiPlaylistVideoSeed | null {
  const contentDetails =
    item.contentDetails && typeof item.contentDetails === "object"
      ? (item.contentDetails as Record<string, unknown>)
      : null;
  const snippet =
    item.snippet && typeof item.snippet === "object"
      ? (item.snippet as Record<string, unknown>)
      : null;
  const resourceId =
    snippet?.resourceId && typeof snippet.resourceId === "object"
      ? (snippet.resourceId as Record<string, unknown>)
      : null;
  const videoIdCandidates = [
    typeof contentDetails?.videoId === "string" ? contentDetails.videoId : null,
    typeof resourceId?.videoId === "string" ? resourceId.videoId : null,
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  const videoId = videoIdCandidates[0]?.trim() ?? null;
  if (!videoId) {
    return null;
  }

  return {
    videoId,
    title:
      typeof snippet?.title === "string" && normalizeText(snippet.title)
        ? normalizeText(snippet.title)
        : null,
    description:
      typeof snippet?.description === "string" && normalizeText(snippet.description)
        ? truncate(normalizeText(snippet.description), MAX_DESCRIPTION_LENGTH)
        : null,
    publishedAt: typeof snippet?.publishedAt === "string" ? snippet.publishedAt : null,
    thumbnailUrl: snippet ? parseYouTubeDataApiThumbnail(snippet) : null,
    channelId: typeof snippet?.channelId === "string" ? snippet.channelId : null,
    channelTitle:
      typeof snippet?.channelTitle === "string" && normalizeText(snippet.channelTitle)
        ? normalizeText(snippet.channelTitle)
        : null,
  };
}

function normalizeVideoFromYouTubeDataApi(params: {
  sourceSlug: string;
  seed: YouTubeDataApiPlaylistVideoSeed;
  metadata: YouTubeDataApiVideoMetadata | null;
}) {
  const metadata = params.metadata;
  const source = params.seed;
  const videoId = source.videoId;
  const title =
    normalizeText(metadata?.title ?? "") ||
    normalizeText(source.title ?? "") ||
    videoId;
  const description =
    metadata?.description ??
    source.description ??
    "";
  const normalizedDescription = truncate(normalizeText(description), MAX_DESCRIPTION_LENGTH);
  const excerpt = truncate(normalizedDescription || title, MAX_EXCERPT_LENGTH);
  const publishedAt = toIsoDate(metadata?.publishedAt ?? source.publishedAt ?? null);
  const slugBase =
    sanitizeSlug(`${params.sourceSlug}-${title}`) || sanitizeSlug(`${params.sourceSlug}-${videoId}`);
  const slug = sanitizeSlug(`${slugBase}-${videoId.slice(0, 8)}`);
  const sourceTags =
    metadata?.tags && metadata.tags.length > 0
      ? deduplicateCaseInsensitive(metadata.tags)
      : [];
  const sourceCategory = metadata?.categoryId
    ? `youtube_category_id:${metadata.categoryId}`
    : null;
  const sourceChannelId = metadata?.channelId ?? source.channelId ?? null;
  const sourceChannelTitle = metadata?.channelTitle ?? source.channelTitle ?? null;
  const thumbnailUrl = metadata?.thumbnailUrl ?? source.thumbnailUrl ?? undefined;

  return {
    externalSourceId: videoId,
    title,
    slug,
    publishedAt,
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    excerpt,
    description: normalizedDescription,
    body: normalizedDescription,
    thumbnailUrl,
    sourceTags,
    sourceCategory,
    sourceChannelId,
    sourceChannelTitle,
    sourcePayload: {
      ingestion: {
        provider: "youtube_data_api_primary",
        importedFromDataApiPrimary: true,
        metadataSources: ["youtube_data_api"],
        sourceTagsExact: sourceTags.length > 0,
      },
      youtubeDataApiSeed: {
        title: source.title,
        publishedAt: source.publishedAt,
        channelId: source.channelId,
        channelTitle: source.channelTitle,
      },
    },
  } satisfies NormalizedYouTubeVideo;
}

async function fetchYouTubeVideosFromDataApiPrimaryPath(params: {
  source: SourceChannel;
  resolved: ResolvedYouTubeSource;
  maxItems: number;
}): Promise<YouTubeDataApiPrimaryPathResult> {
  const requestedMaxItems = getYouTubeDataApiBackfillMaxItems(params.maxItems);
  const pageSize = getYouTubeDataApiBackfillPageSize();
  const telemetry: YouTubeDataApiPrimaryPathResult["telemetry"] = {
    attempted: true,
    used: false,
    requestedMaxItems,
    collectedItems: 0,
    pagesFetched: 0,
    hasMore: false,
    nextPageToken: null,
    uploadsPlaylistId: null,
    channelTitle: null,
    error: null,
  };

  try {
    const uploadsInfo = await fetchYouTubeDataApiUploadsPlaylistInfo(params.resolved.channelId);
    telemetry.uploadsPlaylistId = uploadsInfo.uploadsPlaylistId;
    telemetry.channelTitle = uploadsInfo.channelTitle;

    const orderedVideoIds: string[] = [];
    const seedsByVideoId = new Map<string, YouTubeDataApiPlaylistVideoSeed>();
    let nextPageToken: string | null = null;

    while (orderedVideoIds.length < requestedMaxItems) {
      const endpoint = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      endpoint.searchParams.set("part", "snippet,contentDetails");
      endpoint.searchParams.set("playlistId", uploadsInfo.uploadsPlaylistId);
      endpoint.searchParams.set("maxResults", `${Math.min(pageSize, requestedMaxItems - orderedVideoIds.length)}`);
      endpoint.searchParams.set("key", getYouTubeDataApiKey());
      if (nextPageToken) {
        endpoint.searchParams.set("pageToken", nextPageToken);
      }

      const payload = await fetchJson<Record<string, unknown>>(
        endpoint.toString(),
        getYouTubeDataApiTimeoutMs(),
      );
      telemetry.pagesFetched += 1;

      const items = Array.isArray(payload.items)
        ? payload.items.filter(
            (entry): entry is Record<string, unknown> =>
              typeof entry === "object" && entry !== null,
          )
        : [];

      for (const item of items) {
        const seed = parseYouTubeDataApiPlaylistSeed(item);
        if (!seed) {
          continue;
        }

        const normalizedVideoId = seed.videoId.trim();
        if (!normalizedVideoId || seedsByVideoId.has(normalizedVideoId)) {
          continue;
        }

        seedsByVideoId.set(normalizedVideoId, seed);
        orderedVideoIds.push(normalizedVideoId);
        if (orderedVideoIds.length >= requestedMaxItems) {
          break;
        }
      }

      nextPageToken =
        typeof payload.nextPageToken === "string" && payload.nextPageToken.trim().length > 0
          ? payload.nextPageToken
          : null;
      if (!nextPageToken) {
        break;
      }
    }

    telemetry.collectedItems = orderedVideoIds.length;
    telemetry.nextPageToken = nextPageToken;
    telemetry.hasMore = Boolean(nextPageToken);

    const metadataResult = await fetchYouTubeDataApiVideoMetadata(orderedVideoIds);
    if (!metadataResult.enabled) {
      throw new Error("YouTube Data API metadata fetch is disabled unexpectedly.");
    }
    if (metadataResult.error) {
      throw new Error(metadataResult.error);
    }

    const videos: NormalizedYouTubeVideo[] = [];
    for (const videoId of orderedVideoIds) {
      const seed = seedsByVideoId.get(videoId);
      if (!seed) {
        continue;
      }

      videos.push(
        normalizeVideoFromYouTubeDataApi({
          sourceSlug: params.source.slug,
          seed,
          metadata: metadataResult.videosById.get(videoId) ?? null,
        }),
      );
    }

    telemetry.used = videos.length > 0;

    return {
      videos,
      dataApiResult: metadataResult,
      telemetry,
    };
  } catch (error) {
    telemetry.error = error instanceof Error ? error.message : "youtube_data_api_primary_error";
    return {
      videos: [],
      dataApiResult: {
        enabled: true,
        used: false,
        error: telemetry.error,
        videosById: new Map<string, YouTubeDataApiVideoMetadata>(),
      },
      telemetry,
    };
  }
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

async function enrichVideoFromAdditionalSources(
  video: NormalizedYouTubeVideo,
  options?: {
    dataApiMetadata?: YouTubeDataApiVideoMetadata | null;
    dataApiEnabled?: boolean;
    dataApiError?: string | null;
  },
) {
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
  const dataApiMetadata = options?.dataApiMetadata ?? null;
  const existingIngestion =
    video.sourcePayload &&
    typeof video.sourcePayload === "object" &&
    (video.sourcePayload as Record<string, unknown>).ingestion &&
    typeof (video.sourcePayload as Record<string, unknown>).ingestion === "object"
      ? ((video.sourcePayload as Record<string, unknown>).ingestion as Record<string, unknown>)
      : null;
  const baseMetadataSources = Array.isArray(existingIngestion?.metadataSources)
    ? existingIngestion.metadataSources.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : ["feed"];
  const mergedDescription = mergeDescription(video.description, watchMetadata?.description ?? null);
  const description = dataApiMetadata?.description ?? mergedDescription.description;

  const resolvedTitle =
    normalizeText(dataApiMetadata?.title ?? "") ||
    normalizeText(oEmbedMetadata?.title ?? "") ||
    normalizeText(video.title) ||
    video.externalSourceId;
  const resolvedThumbnail =
    dataApiMetadata?.thumbnailUrl ??
    oEmbedMetadata?.thumbnailUrl ??
    watchMetadata?.thumbnailUrl ??
    video.thumbnailUrl;
  const resolvedTags =
    dataApiMetadata?.tags.length && dataApiMetadata.tags.length > 0
      ? deduplicateCaseInsensitive(dataApiMetadata.tags)
      : deduplicateCaseInsensitive([
          ...video.sourceTags,
          ...(watchMetadata?.keywords ?? []),
        ]);
  const resolvedCategory =
    dataApiMetadata?.categoryId
      ? `youtube_category_id:${dataApiMetadata.categoryId}`
      : watchMetadata?.category ?? video.sourceCategory;
  const resolvedChannelId =
    dataApiMetadata?.channelId ??
    watchMetadata?.channelId ??
    oEmbedMetadata?.channelId ??
    video.sourceChannelId;
  const resolvedChannelTitle =
    dataApiMetadata?.channelTitle ??
    oEmbedMetadata?.authorName ??
    watchMetadata?.channelTitle ??
    video.sourceChannelTitle;
  const excerpt = truncate(description || resolvedTitle, MAX_EXCERPT_LENGTH);

  const metadataSources = deduplicateCaseInsensitive([
    ...baseMetadataSources,
    dataApiMetadata ? "youtube_data_api" : "",
    watchMetadata ? "watch_page" : "",
    oEmbedMetadata ? "oembed" : "",
  ].filter(Boolean));

  const titleReliability = dataApiMetadata?.title
    ? ({ level: "high", source: "youtube_data_api", present: true } as const)
    : oEmbedMetadata?.title
    ? ({ level: "high", source: "oembed", present: true } as const)
    : resolvedTitle && resolvedTitle !== video.externalSourceId
      ? ({ level: "medium", source: "feed", present: true } as const)
      : ({ level: "low", source: "video_id_fallback", present: false } as const);

  const descriptionReliability = dataApiMetadata?.description
    ? ({ level: "high", source: "youtube_data_api", present: true } as const)
    : mergedDescription.usedWatchDescription
    ? ({ level: "medium", source: "watch_page", present: true } as const)
    : description
      ? ({ level: "low", source: "feed", present: true } as const)
      : ({ level: "low", source: "missing", present: false } as const);

  const thumbnailReliability = dataApiMetadata?.thumbnailUrl
    ? ({ level: "high", source: "youtube_data_api", present: true } as const)
    : oEmbedMetadata?.thumbnailUrl
    ? ({ level: "high", source: "oembed", present: true } as const)
    : watchMetadata?.thumbnailUrl || video.thumbnailUrl
      ? ({
          level: "medium",
          source: watchMetadata?.thumbnailUrl ? "watch_page" : "feed",
          present: true,
        } as const)
      : ({ level: "low", source: "missing", present: false } as const);

  const sourceTagsExact = Boolean(dataApiMetadata?.tags.length && dataApiMetadata.tags.length > 0);
  const sourceTagsReliability =
    sourceTagsExact
      ? ({ level: "high", source: "youtube_data_api", present: true } as const)
      : resolvedTags.length >= 3 && (watchMetadata?.keywords.length ?? 0) > 0
      ? ({ level: "medium", source: "feed+watch_page", present: true } as const)
      : resolvedTags.length > 0
        ? ({ level: "low", source: "feed_or_watch_page", present: true } as const)
        : ({ level: "low", source: "missing", present: false } as const);

  const sourceCategoryReliability = resolvedCategory
    ? ({
        level: dataApiMetadata?.categoryId ? "high" : watchMetadata?.category ? "medium" : "low",
        source: dataApiMetadata?.categoryId ? "youtube_data_api" : watchMetadata?.category ? "watch_page" : "feed",
        present: true,
      } as const)
    : ({ level: "low", source: "missing", present: false } as const);

  const channelIdentityReliability =
    resolvedChannelId && resolvedChannelTitle
      ? ({
          level:
            dataApiMetadata?.channelId && dataApiMetadata?.channelTitle
              ? "high"
              : oEmbedMetadata?.authorName || watchMetadata?.channelId
                ? "high"
                : "medium",
          source: dataApiMetadata?.channelId
            ? "youtube_data_api"
            : oEmbedMetadata?.authorName
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
        provider:
          typeof existingIngestion?.provider === "string" && existingIngestion.provider.trim().length > 0
            ? `${existingIngestion.provider}_enriched`
            : "youtube_multi_source_enriched",
        youtubeDataApiEnabled: options?.dataApiEnabled ?? false,
        youtubeDataApiUsed: Boolean(dataApiMetadata),
        youtubeDataApiError: options?.dataApiError ?? null,
        sourceTagsExact,
        watchEnriched: Boolean(watchMetadata),
        oembedEnriched: Boolean(oEmbedMetadata),
        usedWatchDescription: mergedDescription.usedWatchDescription,
        usedDataApiDescription: Boolean(dataApiMetadata?.description),
        metadataSources,
        watchEnrichmentError: watchResult.error,
        oembedEnrichmentError: oEmbedResult.error,
        metadataQuality: {
          overallReliability: normalizeReliabilityLevel(reliabilityScore),
          missingCriticalFields,
          exactSignals: {
            titleExact: Boolean(dataApiMetadata?.title),
            descriptionExact: Boolean(dataApiMetadata?.description),
            sourceTagsExact,
            sourceCategoryExact: Boolean(dataApiMetadata?.categoryId),
            channelIdentityExact: Boolean(dataApiMetadata?.channelId && dataApiMetadata?.channelTitle),
            thumbnailExact: Boolean(dataApiMetadata?.thumbnailUrl),
          },
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
      youtubeDataApiMetadata: dataApiMetadata
        ? {
            title: dataApiMetadata.title,
            descriptionLength: dataApiMetadata.description?.length ?? 0,
            tagCount: dataApiMetadata.tags.length,
            categoryId: dataApiMetadata.categoryId,
            channelId: dataApiMetadata.channelId,
            channelTitle: dataApiMetadata.channelTitle,
            publishedAt: dataApiMetadata.publishedAt,
            thumbnailUrl: dataApiMetadata.thumbnailUrl,
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
  const feedMaxItems =
    options?.maxItems ??
    Number.parseInt(process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE ?? "15", 10);
  const normalizedFeedLimit = Number.isFinite(feedMaxItems) && feedMaxItems > 0 ? feedMaxItems : 15;
  const shouldAttemptDataApiPrimaryPath =
    isYouTubeDataApiEnabled() && isYouTubeDataApiPrimaryPathEnabled();

  let videos: NormalizedYouTubeVideo[] = [];
  let dataApiResult: YouTubeDataApiFetchResult = {
    enabled: false,
    used: false,
    error: null,
    videosById: new Map<string, YouTubeDataApiVideoMetadata>(),
  };
  let dataAcquisitionPath: "youtube_data_api_primary" | "youtube_feed_fallback" =
    "youtube_feed_fallback";
  let dataApiPrimaryTelemetry: YouTubeDataApiPrimaryPathResult["telemetry"] | null = null;

  if (shouldAttemptDataApiPrimaryPath) {
    const primaryPathResult = await fetchYouTubeVideosFromDataApiPrimaryPath({
      source,
      resolved,
      maxItems: options?.maxItems ?? getYouTubeDataApiBackfillMaxItems(),
    });
    dataApiPrimaryTelemetry = primaryPathResult.telemetry;

    if (primaryPathResult.videos.length > 0) {
      videos = primaryPathResult.videos;
      dataApiResult = primaryPathResult.dataApiResult;
      dataAcquisitionPath = "youtube_data_api_primary";
    }
  }

  if (videos.length === 0) {
    const xml = await fetchText(resolved.feedUrl);
    for (const entryXml of parseFeedEntries(xml)) {
      const normalized = normalizeVideoFromFeedEntry(entryXml, source.slug);
      if (!normalized) {
        continue;
      }

      videos.push(normalized);
      if (videos.length >= normalizedFeedLimit) {
        break;
      }
    }

    dataApiResult = await fetchYouTubeDataApiVideoMetadata(
      videos.map((video) => video.externalSourceId),
    );
    dataAcquisitionPath = "youtube_feed_fallback";
  }

  const shouldUseAdditionalEnrichment =
    isWatchEnrichmentEnabled() || isOEmbedEnrichmentEnabled() || dataApiResult.enabled;
  const enriched = shouldUseAdditionalEnrichment
    ? await Promise.all(
        videos.map((video) =>
          enrichVideoFromAdditionalSources(video, {
            dataApiMetadata: dataApiResult.videosById.get(video.externalSourceId) ?? null,
            dataApiEnabled: dataApiResult.enabled,
            dataApiError: dataApiResult.error,
          }),
        ),
      )
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
          dataAcquisitionPath,
          dataApiPrimaryPathAttempted: shouldAttemptDataApiPrimaryPath,
          dataApiPrimaryPathUsed: dataAcquisitionPath === "youtube_data_api_primary",
          dataApiPrimaryPathError: dataApiPrimaryTelemetry?.error ?? null,
          dataApiBackfillRequestedMaxItems: dataApiPrimaryTelemetry?.requestedMaxItems ?? null,
          dataApiBackfillCollectedItems: dataApiPrimaryTelemetry?.collectedItems ?? null,
          dataApiBackfillPagesFetched: dataApiPrimaryTelemetry?.pagesFetched ?? null,
          dataApiBackfillHasMore: dataApiPrimaryTelemetry?.hasMore ?? null,
          dataApiBackfillNextPageToken: dataApiPrimaryTelemetry?.nextPageToken ?? null,
          dataApiBackfillUploadsPlaylistId: dataApiPrimaryTelemetry?.uploadsPlaylistId ?? null,
        },
      },
    })),
  };
}
