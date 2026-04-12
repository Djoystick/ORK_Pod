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
  sourcePayload: Record<string, unknown>;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
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

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function extractFirstMatch(source: string, expression: RegExp) {
  const match = source.match(expression);
  return match?.[1]?.trim() ?? null;
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
  const channelIdFromJson = extractFirstMatch(
    html,
    /"channelId":"(UC[\w-]+)"/i,
  );
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

  const title = normalizeText(titleRaw);
  const description = truncate(normalizeText(descriptionRaw), MAX_DESCRIPTION_LENGTH);
  const excerptSource = description || title;
  const excerpt = truncate(excerptSource, MAX_EXCERPT_LENGTH);
  const publishedAt = toIsoDate(
    extractFirstMatch(entryXml, /<published>([^<]+)<\/published>/i) ??
      extractFirstMatch(entryXml, /<updated>([^<]+)<\/updated>/i),
  );

  const baseSlug = sanitizeSlug(`${sourceSlug}-${title}`) || sanitizeSlug(`${sourceSlug}-${videoId}`);
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
    sourcePayload: {
      ingestion: {
        provider: "youtube_rss",
        importedFromFeed: true,
      },
      raw: {
        entryXml,
      },
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

  return {
    resolved,
    videos,
  };
}
