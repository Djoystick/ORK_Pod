import { randomUUID } from "node:crypto";

import "server-only";

import { categories, platforms, seriesList, tags } from "@/data";
import { buildCommentAuthorReputation } from "@/lib/comment-reputation";
import { resolveContentItems, sortItemsByDate } from "@/lib/content";
import {
  fetchYouTubeChannelPlaylists,
  fetchYouTubeChannelVideos,
  type NormalizedYouTubePlaylist,
  type NormalizedYouTubeVideo,
} from "@/server/services/youtube-ingestion-service";
import {
  readLocalFallbackContentItems,
  readLocalFallbackCommentFeedback,
  readLocalFallbackComments,
  readLocalFallbackImportRuns,
  readLocalFallbackPlaylistItems,
  readLocalFallbackPlaylists,
  readLocalFallbackReactions,
  readLocalFallbackSourceChannels,
  writeLocalFallbackContentItems,
  writeLocalFallbackCommentFeedback,
  writeLocalFallbackComments,
  writeLocalFallbackImportRuns,
  writeLocalFallbackPlaylistItems,
  writeLocalFallbackPlaylists,
  writeLocalFallbackReactions,
  writeLocalFallbackSourceChannels,
} from "@/server/storage/local-fallback-store";
import type {
  CommentAuthorReputation,
  CommentFeedbackRecord,
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
  Playlist,
  PlaylistItem,
  ReactionRecord,
  UpdateCommentModerationInput,
  ResolvedSourceChannel,
  SourceChannel,
  UpdateContentItemInput,
  UpsertCommentFeedbackInput,
  UpsertCommentFeedbackResult,
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

type MappingConfidence = "high" | "medium" | "low";
type MetadataReliability = "high" | "medium" | "low";
type PublishDecision = "keep_draft" | "review_required" | "auto_publish";
type AutomationReviewState = "review_needed" | "review_light" | "auto_published";

type AutoMappingResult = {
  categoryId: string;
  categorySlug: string;
  seriesId: string | null;
  seriesSlug: string | null;
  tagIds: string[];
  score: number;
  confidence: MappingConfidence;
  metadataReliability: MetadataReliability;
  needsReview: boolean;
  fallbackUsed: boolean;
  reasonCodes: string[];
  matchedTerms: string[];
};

type MetadataSignals = {
  overallReliability: MetadataReliability;
  missingCriticalFields: string[];
  reasonCodes: string[];
};

type AutomationDecision = {
  publishDecision: PublishDecision;
  reviewState: AutomationReviewState;
  targetStatus: ContentStatus;
  autoPublishEnabled: boolean;
  autoPublishApplied: boolean;
  metadataReliability: MetadataReliability;
  reasonCodes: string[];
};

type SourceAutomationProfile = {
  preferredCategorySlug?: string;
  preferredSeriesSlug?: string;
  preferredTagSlugs?: string[];
  keywordBoosts?: string[];
};

type PlaylistSignals = {
  playlistTitles: string[];
  playlistIds: string[];
};

function pickPalette(seed: string): [string, string] {
  const score = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackPalettes[score % fallbackPalettes.length];
}

function ensureValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    throw new Error("Invalid external URL");
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
    throw new Error("Category was not found");
  }

  const selectedSeries = input.seriesSlug
    ? seriesList.find((entry) => entry.slug === input.seriesSlug)
    : null;

  if (input.seriesSlug && !selectedSeries) {
    throw new Error("Series was not found");
  }
  if (selectedSeries && selectedSeries.categoryId !== category.id) {
    throw new Error("Series does not belong to selected category");
  }

  return { category, series: selectedSeries };
}

function resolvePlatformBySlug(platformSlug: string) {
  const platform = platforms.find((entry) => entry.slug === platformSlug);
  if (!platform) {
    throw new Error("Platform was not found");
  }

  return platform;
}

function updatePrimaryLink(item: ContentItem, url: string): ExternalLink[] {
  const nextLinks = [...item.links];
  const primaryIndex = nextLinks.findIndex((entry) => entry.label === "Open source");

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
      label: "Open source",
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

function isCanonicalYouTubeChannelId(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^UC[\w-]{22}$/.test(value.trim());
}

function chooseDefaultImportedSeriesId(categoryId: string) {
  const preferred = seriesList.find((entry) => entry.slug === "archive-notes");
  if (preferred && preferred.categoryId === categoryId) {
    return preferred.id;
  }

  return seriesList.find((entry) => entry.categoryId === categoryId)?.id ?? null;
}

function parseMetadataReliability(value: unknown): MetadataReliability | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
}

function isAutoPublishEnabled() {
  const raw = (process.env.YOUTUBE_INGESTION_ENABLE_AUTOPUBLISH ?? "false")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function readMetadataSignals(video: NormalizedYouTubeVideo): MetadataSignals {
  const ingestionPayload =
    video.sourcePayload &&
    typeof video.sourcePayload === "object" &&
    typeof (video.sourcePayload as Record<string, unknown>).ingestion === "object"
      ? ((video.sourcePayload as Record<string, unknown>).ingestion as Record<string, unknown>)
      : null;

  const qualityPayload =
    ingestionPayload && typeof ingestionPayload.metadataQuality === "object"
      ? (ingestionPayload.metadataQuality as Record<string, unknown>)
      : null;

  const payloadReliability = parseMetadataReliability(qualityPayload?.overallReliability);
  const payloadMissingFields = Array.isArray(qualityPayload?.missingCriticalFields)
    ? qualityPayload?.missingCriticalFields.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  const fallbackMissingFields = [
    video.title.trim() ? "" : "title",
    video.description.trim() ? "" : "description",
    video.thumbnailUrl ? "" : "thumbnail",
    video.sourceChannelId ? "" : "channel_id",
    video.sourceChannelTitle ? "" : "channel_title",
    video.externalUrl.trim() ? "" : "external_url",
  ].filter(Boolean);

  const missingCriticalFields =
    payloadMissingFields.length > 0 ? payloadMissingFields : fallbackMissingFields;

  const overallReliability: MetadataReliability =
    payloadReliability ??
    (missingCriticalFields.length === 0
      ? "medium"
      : missingCriticalFields.length >= 3
        ? "low"
        : "medium");

  const reasonCodes = deduplicateCaseInsensitive([
    `metadata:overall:${overallReliability}`,
    ...missingCriticalFields.map((field) => `metadata:missing:${field}`),
  ]);

  return {
    overallReliability,
    missingCriticalFields,
    reasonCodes,
  };
}

const categoryKeywordRules: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: "practice",
    keywords: [
      "нарезка",
      "хайлайт",
      "эпик",
      "момент",
      "highlight",
      "montage",
      "shorts",
      "kletka",
      "scam line",
      "cleaning simulator",
      "dread hunger",
      "outbound",
      "boba teashop",
    ],
  },
  {
    slug: "community",
    keywords: [
      "стрим",
      "stream",
      "live",
      "кооп",
      "дуэт",
      "прохождение",
      "chained wheels",
      "cooking simulator",
      "pizza",
      "heroes of the storm",
      "tes",
      "skyrim",
      "fishing",
      "goose gone",
    ],
  },
  {
    slug: "analysis",
    keywords: [
      "blizzard",
      "wow",
      "warcraft",
      "diablo",
      "overwatch",
      "dragonflight",
      "shadowlands",
      "immortal",
      "blizzcon",
      "activision",
      "microsoft",
      "новости",
      "разбор",
      "скандал",
      "индустрия",
    ],
  },
  {
    slug: "interview",
    keywords: [
      "интервью",
      "беседа",
      "подкаст",
      "разговор",
      "гость",
      "interview",
      "podcast",
      "conversation",
    ],
  },
];

const seriesKeywordRules: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: "live-build",
    keywords: ["нарезка", "хайлайт", "эпик", "montage", "highlight", "orkcut"],
  },
  {
    slug: "tooling-lab",
    keywords: ["simulator", "horror", "survival", "kletka", "scam line", "dread hunger"],
  },
  {
    slug: "qna-room",
    keywords: ["стрим", "stream", "live", "кооп", "дуэт", "orkstream"],
  },
  {
    slug: "archive-notes",
    keywords: ["blizzard", "wow", "diablo", "warcraft", "overwatch", "новости", "разбор"],
  },
  {
    slug: "retro-air",
    keywords: ["blizzard", "индустрия", "скандал", "экспертиза", "обзор"],
  },
  {
    slug: "inside-stream",
    keywords: ["интервью", "подкаст", "беседа", "гость", "conversation"],
  },
];

const tagKeywordRules: Record<string, string[]> = {
  nextjs: ["tes", "skyrim", "dovakin", "elder scrolls", "скайрим"],
  streaming: ["stream", "стрим", "live", "эфир", "twitch"],
  editorial: ["нарезка", "highlight", "хайлайт", "montage", "эпик"],
  community: ["кооп", "co-op", "coop", "дуэт", "команда"],
  ux: ["horror", "хоррор", "страш", "ужас", "twisted"],
  analytics: ["новости", "разбор", "скандал", "индустрия", "экспертиза"],
  obs: ["blizzard", "blizzcon", "hots"],
  audio: ["rpg", "adventure", "quest", "сюжет"],
  automation: ["simulator", "симулятор", "sim", "cooking simulator", "crime simulator"],
  typescript: ["action", "экшен", "battle", "битва", "fight"],
  archive: ["wow", "diablo", "warcraft", "overwatch", "dragonflight", "shadowlands"],
  process: ["обсуждение", "reaction", "реакт", "анонс", "экспертиза"],
};

const sourceAutomationProfiles: Record<string, SourceAutomationProfile> = {
  orkcut: {
    preferredCategorySlug: "practice",
    preferredSeriesSlug: "live-build",
    preferredTagSlugs: ["editorial", "automation", "ux"],
    keywordBoosts: ["нарезка", "хайлайт", "эпик", "симулятор", "хоррор"],
  },
  orkstream: {
    preferredCategorySlug: "community",
    preferredSeriesSlug: "qna-room",
    preferredTagSlugs: ["streaming", "community", "nextjs"],
    keywordBoosts: ["стрим", "кооп", "tes", "skyrim", "duo"],
  },
  "orkpod-youtube": {
    preferredCategorySlug: "analysis",
    preferredSeriesSlug: "archive-notes",
    preferredTagSlugs: ["analytics", "obs", "archive", "process"],
    keywordBoosts: ["blizzard", "wow", "diablo", "новости", "разбор"],
  },
};

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function deduplicateCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function listKeywordMatches(haystack: string, keywords: string[]) {
  const normalizedHaystack = normalizeForMatch(haystack);
  return deduplicateCaseInsensitive(
    keywords.filter((entry) => normalizedHaystack.includes(normalizeForMatch(entry))),
  );
}

function computeKeywordSignal(params: {
  searchable: string;
  titleOnly: string;
  keywords: string[];
  boost?: number;
}) {
  const allMatches = listKeywordMatches(params.searchable, params.keywords);
  const titleMatches = listKeywordMatches(params.titleOnly, params.keywords);
  const score = allMatches.length * 2 + titleMatches.length * 3 + (params.boost ?? 0);

  return {
    score,
    allMatches,
    titleMatches,
  };
}

function sortAndDeduplicate(values: string[]) {
  return deduplicateCaseInsensitive(values).sort((a, b) => a.localeCompare(b));
}

const lowSignalSourceTags = new Set([
  "video",
  "videos",
  "youtube",
  "stream",
  "shorts",
  "gaming",
  "gameplay",
  "игра",
  "dela",
  "ladda upp",
  "gratis",
  "kameratelefon",
  "videotelefon",
]);

function normalizeSourceTagSignalsForMapping(rawTags: string[]) {
  return sortAndDeduplicate(
    rawTags
      .map((entry) => normalizeForMatch(entry))
      .filter((entry) => entry.length >= 3)
      .filter((entry) => /[a-zа-я0-9]/i.test(entry))
      .filter((entry) => !lowSignalSourceTags.has(entry)),
  );
}

function hasExactSourceTagsSignal(video: NormalizedYouTubeVideo) {
  const ingestion =
    video.sourcePayload &&
    typeof video.sourcePayload === "object" &&
    (video.sourcePayload as Record<string, unknown>).ingestion &&
    typeof (video.sourcePayload as Record<string, unknown>).ingestion === "object"
      ? ((video.sourcePayload as Record<string, unknown>).ingestion as Record<string, unknown>)
      : null;

  return ingestion?.sourceTagsExact === true;
}

function areSameStringSets(left: string[] | undefined | null, right: string[] | undefined | null) {
  const a = sortAndDeduplicate(left ?? []);
  const b = sortAndDeduplicate(right ?? []);
  if (a.length !== b.length) {
    return false;
  }

  return a.every((entry, index) => entry === b[index]);
}

function readIngestionOperationalSignals(payload: Record<string, unknown> | null | undefined) {
  const ingestion =
    payload?.ingestion && typeof payload.ingestion === "object"
      ? (payload.ingestion as Record<string, unknown>)
      : null;

  const metadataSources = Array.isArray(ingestion?.metadataSources)
    ? sortAndDeduplicate(
        ingestion.metadataSources.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        ),
      )
    : [];

  return {
    dataAcquisitionPath:
      typeof ingestion?.dataAcquisitionPath === "string"
        ? ingestion.dataAcquisitionPath
        : null,
    youtubeDataApiUsed: ingestion?.youtubeDataApiUsed === true,
    sourceTagsExact: ingestion?.sourceTagsExact === true,
    metadataSources,
  };
}

function buildAutoMappingResult(params: {
  video: NormalizedYouTubeVideo;
  source: SourceChannel;
  defaultCategoryId: string;
  defaultSeriesId: string | null;
  metadataSignals?: MetadataSignals;
  playlistSignals?: PlaylistSignals | null;
}) {
  const metadataSignals = params.metadataSignals ?? readMetadataSignals(params.video);
  const sourceProfile = sourceAutomationProfiles[params.source.slug] ?? null;
  const sourceProfileBoostTerms = sourceProfile?.keywordBoosts ?? [];
  const playlistTitles = params.playlistSignals?.playlistTitles ?? [];
  const playlistIds = params.playlistSignals?.playlistIds ?? [];

  const searchable = [
    params.video.title,
    params.video.excerpt,
    params.video.description,
    params.video.body,
    params.video.sourceCategory ?? "",
    params.video.sourceChannelTitle ?? "",
    params.source.title,
    params.source.slug,
    ...normalizeSourceTagSignalsForMapping(params.video.sourceTags),
    ...playlistTitles,
    ...playlistIds,
    ...sourceProfileBoostTerms,
  ].join(" ");
  const titleOnly = [params.video.title, params.video.sourceCategory ?? ""].join(" ");

  const defaultCategory =
    categories.find((entry) => entry.id === params.defaultCategoryId) ??
    categories.find((entry) => entry.slug === "analysis") ??
    categories[0];

  let selectedCategory = defaultCategory;
  let selectedCategorySignal = {
    score: sourceProfile?.preferredCategorySlug === defaultCategory.slug ? 3 : 0,
    allMatches: [] as string[],
    titleMatches: [] as string[],
  };

  for (const rule of categoryKeywordRules) {
    const category = categories.find((entry) => entry.slug === rule.slug);
    if (!category) continue;

    const signal = computeKeywordSignal({
      searchable,
      titleOnly,
      keywords: rule.keywords,
      boost: sourceProfile?.preferredCategorySlug === rule.slug ? 3 : 0,
    });

    if (
      signal.score > selectedCategorySignal.score ||
      (signal.score === selectedCategorySignal.score &&
        signal.titleMatches.length > selectedCategorySignal.titleMatches.length) ||
      (signal.score === selectedCategorySignal.score &&
        signal.titleMatches.length === selectedCategorySignal.titleMatches.length &&
        rule.slug.localeCompare(selectedCategory.slug) < 0)
    ) {
      selectedCategory = category;
      selectedCategorySignal = signal;
    }
  }

  const categorySeries = seriesList.filter((entry) => entry.categoryId === selectedCategory.id);
  const defaultSeries =
    categorySeries.find((entry) => entry.id === params.defaultSeriesId) ??
    categorySeries.find((entry) => entry.slug === "archive-notes") ??
    categorySeries[0] ??
    null;

  let selectedSeries = defaultSeries;
  let selectedSeriesSignal = {
    score: defaultSeries && sourceProfile?.preferredSeriesSlug === defaultSeries.slug ? 2 : 0,
    allMatches: [] as string[],
    titleMatches: [] as string[],
  };

  for (const rule of seriesKeywordRules) {
    const series = categorySeries.find((entry) => entry.slug === rule.slug);
    if (!series) continue;

    const signal = computeKeywordSignal({
      searchable,
      titleOnly,
      keywords: rule.keywords,
      boost: sourceProfile?.preferredSeriesSlug === rule.slug ? 2 : 0,
    });

    if (
      signal.score > selectedSeriesSignal.score ||
      (signal.score === selectedSeriesSignal.score &&
        signal.titleMatches.length > selectedSeriesSignal.titleMatches.length) ||
      (signal.score === selectedSeriesSignal.score &&
        signal.titleMatches.length === selectedSeriesSignal.titleMatches.length &&
        rule.slug.localeCompare(selectedSeries?.slug ?? "") < 0)
    ) {
      selectedSeries = series;
      selectedSeriesSignal = signal;
    }
  }

  const sourceTagSignals = normalizeSourceTagSignalsForMapping(params.video.sourceTags);
  const exactSourceTags = hasExactSourceTagsSignal(params.video);
  const preferredTagSlugSet = new Set(sourceProfile?.preferredTagSlugs ?? []);
  const tagCandidateEntries = tags
    .map((entry) => {
      const rules = tagKeywordRules[entry.slug] ?? [];
      const keywordSignal = computeKeywordSignal({
        searchable,
        titleOnly,
        keywords: rules,
        boost: preferredTagSlugSet.has(entry.slug) ? 1 : 0,
      });

      const directTagMatch = sourceTagSignals.some(
        (signal) =>
          signal.includes(entry.slug.toLowerCase()) ||
          signal.includes(entry.label.toLowerCase()),
      );
      const directScore = directTagMatch ? (exactSourceTags ? 5 : 3) : 0;
      const sourceProfileBoost = preferredTagSlugSet.has(entry.slug) ? 2 : 0;
      const totalScore = keywordSignal.score + directScore + sourceProfileBoost;

      return {
        id: entry.id,
        slug: entry.slug,
        totalScore,
        keywordMatches: keywordSignal.allMatches,
        directTagMatch,
      };
    })
    .filter((entry) => entry.totalScore >= 3 || (entry.directTagMatch && entry.totalScore >= 2))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.slug.localeCompare(b.slug);
    });

  const tagIds = sortAndDeduplicate(tagCandidateEntries.map((entry) => entry.id));
  const profileFallbackTagIds =
    tagIds.length === 0
      ? sortAndDeduplicate(
          tags
            .filter((entry) => preferredTagSlugSet.has(entry.slug))
            .map((entry) => entry.id),
        )
      : [];
  const resolvedTagIds = tagIds.length > 0 ? tagIds : profileFallbackTagIds;

  const mappedTerms = deduplicateCaseInsensitive([
    ...selectedCategorySignal.allMatches,
    ...selectedSeriesSignal.allMatches,
    ...tagCandidateEntries.flatMap((entry) => entry.keywordMatches),
    ...sourceTagSignals,
    ...playlistTitles,
    ...listKeywordMatches(searchable, sourceProfileBoostTerms),
  ]);

  const playlistSignalStrength =
    playlistTitles.length >= 2 ? 2 : playlistTitles.length === 1 ? 1 : 0;

  const score =
    selectedCategorySignal.score +
    selectedSeriesSignal.score +
    (resolvedTagIds.length >= 3 ? 4 : resolvedTagIds.length > 0 ? 2 : 0) +
    playlistSignalStrength +
    (sourceTagSignals.length >= 2 ? 1 : 0) +
    (exactSourceTags ? 3 : 0) +
    (metadataSignals.overallReliability === "high"
      ? 2
      : metadataSignals.overallReliability === "medium"
        ? 1
        : 0);

  const hasStrongSemanticSignals =
    selectedCategorySignal.allMatches.length > 0 ||
    selectedSeriesSignal.allMatches.length > 0 ||
    tagCandidateEntries.some((entry) => entry.totalScore >= 4) ||
    playlistTitles.length > 0;

  let confidence: MappingConfidence = score >= 12 ? "high" : score >= 7 ? "medium" : "low";
  if (metadataSignals.overallReliability === "low" && confidence === "high") {
    confidence = "medium";
  }
  if (metadataSignals.overallReliability === "low" && confidence === "medium") {
    confidence = "low";
  }
  if (!hasStrongSemanticSignals && !exactSourceTags && confidence === "high") {
    confidence = "medium";
  }

  const fallbackUsed =
    (selectedCategorySignal.allMatches.length === 0 && !sourceProfile?.preferredCategorySlug) ||
    (selectedSeriesSignal.allMatches.length === 0 &&
      !sourceProfile?.preferredSeriesSlug &&
      Boolean(selectedSeries)) ||
    (resolvedTagIds.length === 0 && !exactSourceTags && playlistTitles.length === 0);
  const needsReview =
    confidence !== "high" ||
    fallbackUsed ||
    !hasStrongSemanticSignals ||
    metadataSignals.overallReliability !== "high" ||
    metadataSignals.missingCriticalFields.length > 0;

  return {
    categoryId: selectedCategory.id,
    categorySlug: selectedCategory.slug,
    seriesId: selectedSeries?.id ?? null,
    seriesSlug: selectedSeries?.slug ?? null,
    tagIds: resolvedTagIds,
    score,
    confidence,
    metadataReliability: metadataSignals.overallReliability,
    needsReview,
    fallbackUsed,
    reasonCodes: deduplicateCaseInsensitive([
      `category:${selectedCategory.slug}:score_${selectedCategorySignal.score}`,
      `series:${selectedSeries?.slug ?? "none"}:score_${selectedSeriesSignal.score}`,
      `tags:${resolvedTagIds.length}`,
      `mapping_score:${score}`,
      `mapping_confidence:${confidence}`,
      `source_tags_exact:${exactSourceTags ? "true" : "false"}`,
      `playlist_signals:${playlistTitles.length}`,
      `semantic_signals:${hasStrongSemanticSignals ? "strong" : "weak"}`,
      sourceProfile ? `source_profile:${params.source.slug}` : "source_profile:none",
      `metadata_reliability:${metadataSignals.overallReliability}`,
      ...metadataSignals.reasonCodes,
      fallbackUsed ? "fallback:manual_review_recommended" : "fallback:none",
    ]),
    matchedTerms: mappedTerms,
  } satisfies AutoMappingResult;
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
  title?: string;
  slug?: string;
  excerpt?: string;
  description?: string;
  body?: string;
  categoryId?: string;
  seriesId?: string | null;
  tagIds?: string[];
  publishedAt?: string;
  primaryUrl?: string;
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
    title: typeof raw.title === "string" ? raw.title : undefined,
    slug: typeof raw.slug === "string" ? raw.slug : undefined,
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    body: typeof raw.body === "string" ? raw.body : undefined,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : undefined,
    seriesId:
      typeof raw.seriesId === "string" || raw.seriesId === null
        ? (raw.seriesId as string | null)
        : undefined,
    tagIds: Array.isArray(raw.tagIds)
      ? raw.tagIds.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : undefined,
    primaryUrl: typeof raw.primaryUrl === "string" ? raw.primaryUrl : undefined,
  };
}

function mergeImportedTextContent(
  existing: ContentItem,
  incoming: NormalizedYouTubeVideo,
  snapshot: ImportSnapshot,
) {
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

function canReplaceScalar(
  currentValue: string | null | undefined,
  snapshotValue: string | null | undefined,
) {
  if (!currentValue) {
    return true;
  }

  if (snapshotValue === undefined) {
    return true;
  }

  return currentValue === snapshotValue;
}

function canReplaceTagIds(currentTagIds: string[] | undefined, snapshotTagIds: string[] | undefined) {
  if (!currentTagIds || currentTagIds.length === 0) {
    return true;
  }

  if (!snapshotTagIds) {
    return true;
  }

  return areSameStringSets(currentTagIds, snapshotTagIds);
}

function getPrimaryLinkUrl(item: ContentItem) {
  return item.links[0]?.url ?? null;
}

function buildAutomationDecision(params: {
  mapping: AutoMappingResult;
  metadataSignals: MetadataSignals;
  manualOverrideDetected?: boolean;
  existingStatus?: ContentStatus;
}): AutomationDecision {
  const autoPublishEnabled = isAutoPublishEnabled();
  const manualOverrideDetected = params.manualOverrideDetected === true;
  const hasCriticalMetadataGap = params.metadataSignals.missingCriticalFields.length > 0;

  const strictAutoPublishReady =
    params.mapping.confidence === "high" &&
    !params.mapping.needsReview &&
    !params.mapping.fallbackUsed &&
    params.metadataSignals.overallReliability === "high" &&
    !hasCriticalMetadataGap &&
    !manualOverrideDetected;

  const highConfidenceReviewLight =
    params.mapping.confidence === "high" &&
    !params.mapping.fallbackUsed &&
    params.metadataSignals.overallReliability !== "low" &&
    !hasCriticalMetadataGap &&
    !manualOverrideDetected;

  const baseDecision: Omit<AutomationDecision, "targetStatus"> = strictAutoPublishReady && autoPublishEnabled
    ? {
        publishDecision: "auto_publish",
        reviewState: "auto_published",
        autoPublishEnabled,
        autoPublishApplied: true,
        metadataReliability: params.metadataSignals.overallReliability,
        reasonCodes: deduplicateCaseInsensitive([
          "decision:auto_publish",
          "status:published_by_policy",
          `mapping_confidence:${params.mapping.confidence}`,
          `metadata_reliability:${params.metadataSignals.overallReliability}`,
        ]),
      }
    : highConfidenceReviewLight
      ? {
          publishDecision: "keep_draft",
          reviewState: "review_light",
          autoPublishEnabled,
          autoPublishApplied: false,
          metadataReliability: params.metadataSignals.overallReliability,
          reasonCodes: deduplicateCaseInsensitive([
            "decision:review_light",
            autoPublishEnabled ? "autopublish:not_triggered" : "autopublish:disabled_by_env",
            `mapping_confidence:${params.mapping.confidence}`,
            `metadata_reliability:${params.metadataSignals.overallReliability}`,
          ]),
        }
      : {
          publishDecision: "review_required",
          reviewState: "review_needed",
          autoPublishEnabled,
          autoPublishApplied: false,
          metadataReliability: params.metadataSignals.overallReliability,
          reasonCodes: deduplicateCaseInsensitive([
            "decision:review_required",
            params.mapping.confidence === "low"
              ? "review_reason:low_mapping_confidence"
              : "review_reason:mapping_or_metadata_uncertainty",
            params.mapping.fallbackUsed ? "review_reason:fallback_used" : "",
            hasCriticalMetadataGap ? "review_reason:missing_critical_metadata" : "",
            manualOverrideDetected ? "review_reason:manual_override_detected" : "",
            `mapping_confidence:${params.mapping.confidence}`,
            `metadata_reliability:${params.metadataSignals.overallReliability}`,
          ].filter(Boolean)),
        };

  if (params.existingStatus) {
    return {
      ...baseDecision,
      targetStatus: params.existingStatus,
      reasonCodes: deduplicateCaseInsensitive([
        ...baseDecision.reasonCodes,
        `status:preserved_existing:${params.existingStatus}`,
      ]),
    };
  }

  return {
    ...baseDecision,
    targetStatus: baseDecision.autoPublishApplied ? "published" : DEFAULT_IMPORTED_STATUS,
  };
}

function buildSourcePayload({
  existing,
  source,
  video,
  mapping,
  automationDecision,
  snapshot,
  syncedAt,
}: {
  existing?: Record<string, unknown> | null;
  source: SourceChannel;
  video: NormalizedYouTubeVideo;
  mapping: AutoMappingResult;
  automationDecision: AutomationDecision;
  snapshot: ImportSnapshot;
  syncedAt: string;
}) {
  return {
    ...(existing ?? {}),
    ingestion: {
      provider: "youtube_rss",
      sourceSlug: source.slug,
      externalSourceId: video.externalSourceId,
      syncedAt,
      sourceChannelId: video.sourceChannelId,
      sourceChannelTitle: video.sourceChannelTitle,
      sourceCategory: video.sourceCategory,
      sourceTags: video.sourceTags,
      mappingConfidence: mapping.confidence,
      mappingNeedsReview: mapping.needsReview,
      mappingFallbackUsed: mapping.fallbackUsed,
      mappingScore: mapping.score,
      metadataReliability: mapping.metadataReliability,
      publishDecision: automationDecision.publishDecision,
      reviewState: automationDecision.reviewState,
      ...(video.sourcePayload.ingestion && typeof video.sourcePayload.ingestion === "object"
        ? (video.sourcePayload.ingestion as Record<string, unknown>)
        : {}),
    },
    mapping: {
      categoryId: mapping.categoryId,
      categorySlug: mapping.categorySlug,
      seriesId: mapping.seriesId,
      seriesSlug: mapping.seriesSlug,
      tagIds: mapping.tagIds,
      score: mapping.score,
      confidence: mapping.confidence,
      metadataReliability: mapping.metadataReliability,
      needsReview: mapping.needsReview,
      fallbackUsed: mapping.fallbackUsed,
      reasonCodes: mapping.reasonCodes,
      matchedTerms: mapping.matchedTerms,
    },
    automation: {
      publishDecision: automationDecision.publishDecision,
      reviewState: automationDecision.reviewState,
      targetStatus: automationDecision.targetStatus,
      autoPublishEnabled: automationDecision.autoPublishEnabled,
      autoPublishApplied: automationDecision.autoPublishApplied,
      metadataReliability: automationDecision.metadataReliability,
      reasonCodes: automationDecision.reasonCodes,
      decidedAt: syncedAt,
    },
    ingestionSnapshot: {
      ...snapshot,
      syncedAt,
    },
    raw: (video.sourcePayload.raw as Record<string, unknown> | undefined) ?? null,
  };
}

function buildPlaylistSignalsByVideoId(playlists: NormalizedYouTubePlaylist[]) {
  const signalsByVideoId = new Map<string, PlaylistSignals>();

  for (const playlist of playlists) {
    for (const item of playlist.items) {
      const videoId = item.externalVideoId.trim();
      if (!videoId) {
        continue;
      }

      const existing = signalsByVideoId.get(videoId) ?? {
        playlistTitles: [],
        playlistIds: [],
      };
      existing.playlistTitles = deduplicateCaseInsensitive([
        ...existing.playlistTitles,
        playlist.title,
      ]);
      existing.playlistIds = deduplicateCaseInsensitive([
        ...existing.playlistIds,
        playlist.externalPlaylistId,
      ]);
      signalsByVideoId.set(videoId, existing);
    }
  }

  return signalsByVideoId;
}

async function persistPlaylistsToLocalStore(params: {
  source: SourceChannel;
  playlists: NormalizedYouTubePlaylist[];
  linkedContentItemIdByVideoId: Map<string, string>;
  syncedAt: string;
  syncMode: SourceChannel["playlistSyncMode"];
}) {
  if (params.syncMode !== "api_primary") {
    return {
      syncedAt: params.syncedAt,
      playlistCount: 0,
      playlistItemCount: 0,
    };
  }

  const existingPlaylists = await readLocalFallbackPlaylists();
  const existingPlaylistItems = await readLocalFallbackPlaylistItems();

  const nextPlaylists = [...existingPlaylists];
  const nextPlaylistItems = existingPlaylistItems.filter((entry) => {
    const playlist = existingPlaylists.find((candidate) => candidate.id === entry.playlistId);
    if (!playlist) {
      return false;
    }
    return playlist.sourceChannelId !== params.source.id;
  });

  const fetchedExternalIds = new Set(params.playlists.map((entry) => entry.externalPlaylistId));
  for (let index = 0; index < nextPlaylists.length; index += 1) {
    const playlist = nextPlaylists[index];
    if (playlist.sourceChannelId !== params.source.id) {
      continue;
    }

    if (fetchedExternalIds.has(playlist.externalPlaylistId)) {
      continue;
    }

    nextPlaylists[index] = {
      ...playlist,
      isActive: false,
      lastSyncedAt: params.syncedAt,
      updatedAt: params.syncedAt,
    };
  }

  let playlistItemCount = 0;

  for (const playlist of params.playlists) {
    const existingIndex = nextPlaylists.findIndex(
      (entry) => entry.externalPlaylistId === playlist.externalPlaylistId,
    );
    const playlistId =
      existingIndex >= 0 ? nextPlaylists[existingIndex].id : `playlist-${randomUUID()}`;

    const linkedCount = playlist.items.filter((entry) =>
      params.linkedContentItemIdByVideoId.has(entry.externalVideoId),
    ).length;
    const normalizedPlaylist: Playlist = {
      id: playlistId,
      sourceChannelId: params.source.id,
      externalPlaylistId: playlist.externalPlaylistId,
      slug: playlist.slug,
      title: playlist.title,
      description: playlist.description,
      externalUrl: playlist.externalUrl,
      thumbnailUrl: playlist.thumbnailUrl,
      itemCount: playlist.itemCount,
      syncedItemCount: playlist.items.length,
      linkedItemCount: linkedCount,
      isActive: true,
      publishedAt: playlist.publishedAt,
      sourcePayload: playlist.sourcePayload,
      createdAt: existingIndex >= 0 ? nextPlaylists[existingIndex].createdAt : params.syncedAt,
      updatedAt: params.syncedAt,
      lastSyncedAt: params.syncedAt,
    };

    if (existingIndex >= 0) {
      nextPlaylists[existingIndex] = normalizedPlaylist;
    } else {
      nextPlaylists.push(normalizedPlaylist);
    }

    for (const item of playlist.items) {
      playlistItemCount += 1;
      const normalizedItem: PlaylistItem = {
        id: `playlist-item-${randomUUID()}`,
        playlistId,
        contentItemId:
          params.linkedContentItemIdByVideoId.get(item.externalVideoId) ?? null,
        externalVideoId: item.externalVideoId,
        position: item.position,
        title: item.title,
        addedAt: item.addedAt,
        sourcePayload: item.sourcePayload,
        createdAt: params.syncedAt,
        updatedAt: params.syncedAt,
      };
      nextPlaylistItems.push(normalizedItem);
    }
  }

  await writeLocalFallbackPlaylists(nextPlaylists);
  await writeLocalFallbackPlaylistItems(nextPlaylistItems);

  return {
    syncedAt: params.syncedAt,
    playlistCount: params.playlists.length,
    playlistItemCount,
  };
}

function buildIngestionSnapshot(params: {
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  body?: string;
  categoryId?: string;
  seriesId?: string | null;
  tagIds?: string[];
  publishedAt?: string;
  primaryUrl?: string;
}) {
  return {
    title: params.title,
    slug: params.slug,
    excerpt: params.excerpt,
    description: params.description,
    body: params.body,
    categoryId: params.categoryId,
    seriesId: params.seriesId ?? null,
    tagIds: params.tagIds ?? [],
    publishedAt: params.publishedAt,
    primaryUrl: params.primaryUrl,
  } satisfies ImportSnapshot;
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
    throw new Error("Author name must be between 2 and 48 characters.");
  }

  if (!input.authorFingerprint.trim()) {
    throw new Error("Temporary identity fingerprint is required.");
  }

  const normalizedBody = normalizeCommentBody(input.body);
  if (normalizedBody.length < 3 || normalizedBody.length > 1200) {
    throw new Error("Comment must be between 3 and 1200 characters.");
  }

  const linksCount = (normalizedBody.match(/https?:\/\/\S+/gi) ?? []).length;
  if (linksCount > 2) {
    throw new Error("Too many links in comment. Max allowed: 2.");
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

function resolveCommentAuthorKey(input: {
  authorUserId?: string | null;
  authorFingerprint?: string | null;
}) {
  const authorUserId = input.authorUserId?.trim() ?? "";
  if (authorUserId) {
    return { key: `user:${authorUserId}`, mode: "user" as const, value: authorUserId };
  }

  const authorFingerprint = input.authorFingerprint?.trim() ?? "";
  if (authorFingerprint) {
    return { key: `fingerprint:${authorFingerprint}`, mode: "fingerprint" as const, value: authorFingerprint };
  }

  return null;
}

function isSameCommentActor(comment: CommentRecord, authorKey: ReturnType<typeof resolveCommentAuthorKey>) {
  if (!authorKey) {
    return false;
  }

  if (authorKey.mode === "user") {
    return (comment.authorUserId ?? "") === authorKey.value;
  }

  return (comment.authorFingerprint ?? "") === authorKey.value;
}

function buildAuthorReputationFromLocalRecords(params: {
  comments: CommentRecord[];
  feedback: CommentFeedbackRecord[];
  authorUserId?: string | null;
  authorFingerprint?: string | null;
}): CommentAuthorReputation {
  const authorKey = resolveCommentAuthorKey({
    authorUserId: params.authorUserId,
    authorFingerprint: params.authorFingerprint,
  });
  if (!authorKey) {
    return buildCommentAuthorReputation({
      totalPositive: 0,
      totalNegative: 0,
      totalComments: 0,
      ratedComments: 0,
    });
  }

  const authorComments = params.comments.filter((comment) => isSameCommentActor(comment, authorKey));
  if (authorComments.length === 0) {
    return buildCommentAuthorReputation({
      totalPositive: 0,
      totalNegative: 0,
      totalComments: 0,
      ratedComments: 0,
    });
  }

  const commentIds = new Set(authorComments.map((comment) => comment.id));
  const feedbackForAuthor = params.feedback.filter((entry) => commentIds.has(entry.commentId));
  const totalPositive = feedbackForAuthor.filter((entry) => entry.feedbackType === "up").length;
  const totalNegative = feedbackForAuthor.filter((entry) => entry.feedbackType === "down").length;
  const ratedComments = new Set(feedbackForAuthor.map((entry) => entry.commentId)).size;

  return buildCommentAuthorReputation({
    totalPositive,
    totalNegative,
    totalComments: authorComments.length,
    ratedComments,
  });
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
      throw new Error("Slug already exists");
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
          label: "Open source",
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
      throw new Error("Content item was not found");
    }

    const duplicateSlug = existing.find(
      (item) => item.slug === input.slug && item.id !== input.id,
    );
    if (duplicateSlug) {
      throw new Error("Slug is already used by another item");
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
      throw new Error("Content item was not found");
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
          lastPlaylistSyncedAt: channel.lastPlaylistSyncedAt ?? null,
          lastPlaylistCount: channel.lastPlaylistCount ?? null,
          lastPlaylistItemCount: channel.lastPlaylistItemCount ?? null,
          playlistSyncMode: channel.playlistSyncMode ?? null,
          playlistSyncMessage: channel.playlistSyncMessage ?? null,
          platform,
        };
      })
      .filter(isResolvedSourceChannel);

    return resolved.sort((a, b) => a.title.localeCompare(b.title));
  }

  async listPlaylists(options?: { sourceChannelId?: string; limit?: number }) {
    const playlists = await readLocalFallbackPlaylists();
    const filtered = options?.sourceChannelId
      ? playlists.filter((entry) => entry.sourceChannelId === options.sourceChannelId)
      : playlists;
    const sorted = [...filtered].sort(
      (left, right) =>
        new Date(right.lastSyncedAt ?? right.updatedAt ?? 0).getTime() -
        new Date(left.lastSyncedAt ?? left.updatedAt ?? 0).getTime(),
    );
    const normalizedLimit = Number.isFinite(options?.limit ?? Number.NaN)
      ? Math.max(1, Math.min(250, options?.limit ?? 50))
      : 50;
    return sorted.slice(0, normalizedLimit);
  }

  async createSourceChannel(input: CreateSourceChannelInput) {
    const existing = await readLocalFallbackSourceChannels();
    const now = new Date().toISOString();

    if (existing.some((channel) => channel.slug === input.slug)) {
      throw new Error("Source channel slug already exists");
    }

    const platform = resolvePlatformBySlug(input.platformSlug);

    const sourceUrl = input.sourceUrl?.trim() ? ensureValidUrl(input.sourceUrl) : null;
    const externalChannelId = input.externalChannelId?.trim() || null;
    if (!sourceUrl && !externalChannelId) {
      throw new Error("Provide source URL or external channel id");
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
      lastPlaylistSyncedAt: null,
      lastPlaylistCount: null,
      lastPlaylistItemCount: null,
      playlistSyncMode: null,
      playlistSyncMessage: null,
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
      retryExternalSourceIds?: string[];
    },
  ) {
    const now = new Date().toISOString();
    const sourceChannels = await readLocalFallbackSourceChannels();
    const sourceIndex = sourceChannels.findIndex((channel) => channel.id === sourceId);

    if (sourceIndex < 0) {
      throw new Error("Source channel was not found");
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
        throw new Error("Ingestion is supported only for YouTube source channels.");
      }

      const { resolved, videos } = await fetchYouTubeChannelVideos(source);
      const playlistSyncResult = await fetchYouTubeChannelPlaylists(source, {
        resolved,
      });
      const playlistSignalsByVideoId = buildPlaylistSignalsByVideoId(
        playlistSyncResult.playlists,
      );
      const filteredVideos =
        options?.trigger === "retry_failed_items" &&
        Array.isArray(options.retryExternalSourceIds) &&
        options.retryExternalSourceIds.length > 0
          ? videos.filter((video) => options.retryExternalSourceIds?.includes(video.externalSourceId))
          : videos;
      const allItems = await readLocalFallbackContentItems();

      const defaultCategoryId = chooseDefaultImportedCategoryId();
      const defaultSeriesId = chooseDefaultImportedSeriesId(defaultCategoryId);
      const itemResults: ImportRunItemResult[] = [];

      for (const video of filteredVideos) {
        try {
          const metadataSignals = readMetadataSignals(video);
          const mapping = buildAutoMappingResult({
            video,
            source,
            defaultCategoryId,
            defaultSeriesId,
            metadataSignals,
            playlistSignals: playlistSignalsByVideoId.get(video.externalSourceId) ?? null,
          });
          const existingIndex = allItems.findIndex(
            (item) =>
              item.sourceType === "imported" && item.externalSourceId === video.externalSourceId,
          );

          if (existingIndex < 0) {
            const itemId = `import-${randomUUID()}`;
            const slug = ensureUniqueSlug(allItems, video.slug);
            const primaryUrl = ensureValidUrl(video.externalUrl);
            const publishedAt = toIso(video.publishedAt);
            const automationDecision = buildAutomationDecision({
              mapping,
              metadataSignals,
            });
            const snapshot = buildIngestionSnapshot({
              title: video.title,
              slug,
              excerpt: video.excerpt,
              description: video.description,
              body: video.body,
              categoryId: mapping.categoryId,
              seriesId: mapping.seriesId,
              tagIds: mapping.tagIds,
              publishedAt,
              primaryUrl,
            });
            const importedItem: ContentItem = {
              id: itemId,
              slug,
              title: video.title,
              excerpt: video.excerpt,
              description: video.description,
              body: video.body,
              categoryId: mapping.categoryId,
              seriesId: mapping.seriesId,
              platformId: source.platformId,
              sourceType: "imported",
              contentSourceId: `source-${itemId}`,
              externalSourceId: video.externalSourceId,
              importStatus: "imported",
              status: automationDecision.targetStatus,
              moderationStatus: "clean",
              tagIds: mapping.tagIds,
              publishedAt,
              createdAt: now,
              updatedAt: now,
              durationMinutes: 0,
              cover: deriveThumbnailCover(video),
              links: [
                {
                  kind: "youtube",
                  label: "Open source",
                  url: primaryUrl,
                },
              ],
              sourcePayload: buildSourcePayload({
                source,
                video,
                mapping,
                automationDecision,
                snapshot,
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
              mappingConfidence: mapping.confidence,
              automationReviewState: automationDecision.reviewState,
              automationPublishDecision: automationDecision.publishDecision,
            });
            continue;
          }

          const existing = allItems[existingIndex];
          const snapshot = readImportSnapshot(existing);
          const mergedText = mergeImportedTextContent(existing, video, snapshot);
          const suggestedSlug = ensureUniqueSlug(allItems, video.slug, existing.id);
          const nextPrimaryUrlCandidate = ensureValidUrl(video.externalUrl);
          const nextPublishedAtCandidate = toIso(video.publishedAt);
          const previousPrimaryUrl = getPrimaryLinkUrl(existing);
          const canReplaceTitle = canReplaceScalar(existing.title, snapshot.title);
          const canReplaceSlug = canReplaceScalar(existing.slug, snapshot.slug);
          const canReplacePublishedAt = canReplaceScalar(existing.publishedAt, snapshot.publishedAt);
          const canReplacePrimaryUrl = canReplaceScalar(previousPrimaryUrl, snapshot.primaryUrl);
          const canReplaceCategory = canReplaceScalar(existing.categoryId, snapshot.categoryId);
          const canReplaceSeries = canReplaceScalar(existing.seriesId ?? null, snapshot.seriesId);
          const canReplaceTags = canReplaceTagIds(existing.tagIds, snapshot.tagIds);

          const nextTitle = canReplaceTitle ? video.title : existing.title;
          const nextSlug = canReplaceSlug ? suggestedSlug : existing.slug;
          const nextPublishedAt = canReplacePublishedAt
            ? nextPublishedAtCandidate
            : existing.publishedAt ?? nextPublishedAtCandidate;
          const nextCategoryId = canReplaceCategory
            ? mapping.categoryId
            : existing.categoryId ?? mapping.categoryId;
          const nextSeriesId = canReplaceSeries
            ? mapping.seriesId
            : existing.seriesId ?? mapping.seriesId;
          const nextTagIds = canReplaceTags ? mapping.tagIds : existing.tagIds;
          const nextPrimaryUrl = canReplacePrimaryUrl
            ? nextPrimaryUrlCandidate
            : previousPrimaryUrl ?? nextPrimaryUrlCandidate;
          const manualOverrideDetected =
            !canReplaceCategory ||
            !canReplaceSeries ||
            !canReplaceTags ||
            !canReplaceTitle ||
            !canReplaceSlug;
          const nextMapping = {
            ...mapping,
            categoryId: nextCategoryId,
            seriesId: nextSeriesId,
            tagIds: nextTagIds,
            needsReview:
              mapping.needsReview ||
              manualOverrideDetected,
            reasonCodes: deduplicateCaseInsensitive(
              [
                ...mapping.reasonCodes,
                !canReplaceCategory ? "manual_override:category_preserved" : "",
                !canReplaceSeries ? "manual_override:series_preserved" : "",
                !canReplaceTags ? "manual_override:tags_preserved" : "",
                !canReplaceTitle ? "manual_override:title_preserved" : "",
                !canReplaceSlug ? "manual_override:slug_preserved" : "",
              ].filter(Boolean),
            ),
          } satisfies AutoMappingResult;
          const nextAutomationDecision = buildAutomationDecision({
            mapping: nextMapping,
            metadataSignals,
            manualOverrideDetected,
            existingStatus: existing.status ?? DEFAULT_IMPORTED_STATUS,
          });

          const updateSnapshot = buildIngestionSnapshot({
            title: nextTitle,
            slug: nextSlug,
            excerpt: mergedText.excerpt,
            description: mergedText.description,
            body: mergedText.body,
            categoryId: nextCategoryId,
            seriesId: nextSeriesId,
            tagIds: nextTagIds,
            publishedAt: nextPublishedAt,
            primaryUrl: nextPrimaryUrl,
          });

          const nextSourcePayload = buildSourcePayload({
            existing: existing.sourcePayload ?? null,
            source,
            video,
            mapping: nextMapping,
            automationDecision: nextAutomationDecision,
            snapshot: updateSnapshot,
            syncedAt: now,
          });
          const existingPayloadRecord =
            existing.sourcePayload && typeof existing.sourcePayload === "object"
              ? (existing.sourcePayload as Record<string, unknown>)
              : null;
          const mappingChanged =
            JSON.stringify(existingPayloadRecord?.mapping ?? null) !==
            JSON.stringify((nextSourcePayload as Record<string, unknown>).mapping ?? null);
          const existingAutomationComparable =
            existingPayloadRecord?.automation && typeof existingPayloadRecord.automation === "object"
              ? ({
                  ...(existingPayloadRecord.automation as Record<string, unknown>),
                  decidedAt: null,
                } satisfies Record<string, unknown>)
              : null;
          const nextAutomationComparable =
            (nextSourcePayload as Record<string, unknown>).automation &&
            typeof (nextSourcePayload as Record<string, unknown>).automation === "object"
              ? ({
                  ...((nextSourcePayload as Record<string, unknown>).automation as Record<string, unknown>),
                  decidedAt: null,
                } satisfies Record<string, unknown>)
              : null;
          const automationChanged =
            JSON.stringify(existingAutomationComparable) !==
            JSON.stringify(nextAutomationComparable);
          const existingIngestionOperationalSignals =
            readIngestionOperationalSignals(existingPayloadRecord);
          const nextIngestionOperationalSignals = readIngestionOperationalSignals(
            nextSourcePayload as Record<string, unknown>,
          );
          const ingestionOperationalChanged =
            JSON.stringify(existingIngestionOperationalSignals) !==
            JSON.stringify(nextIngestionOperationalSignals);

          const shouldUpdate =
            existing.title !== nextTitle ||
            existing.slug !== nextSlug ||
            existing.publishedAt !== nextPublishedAt ||
            mergedText.excerpt !== existing.excerpt ||
            mergedText.description !== existing.description ||
            mergedText.body !== existing.body ||
            previousPrimaryUrl !== nextPrimaryUrl ||
            existing.importStatus !== "imported" ||
            existing.categoryId !== nextCategoryId ||
            (existing.seriesId ?? null) !== (nextSeriesId ?? null) ||
            !areSameStringSets(existing.tagIds, nextTagIds) ||
            existing.platformId !== source.platformId ||
            mappingChanged ||
            automationChanged ||
            ingestionOperationalChanged;

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
            title: nextTitle,
            slug: nextSlug,
            excerpt: mergedText.excerpt,
            description: mergedText.description,
            body: mergedText.body,
            categoryId: nextCategoryId,
            seriesId: nextSeriesId,
            tagIds: nextTagIds,
            platformId: source.platformId,
            sourceType: "imported",
            importStatus: "imported",
            status: nextAutomationDecision.targetStatus,
            publishedAt: nextPublishedAt,
            updatedAt: now,
            cover: deriveThumbnailCover(video),
            links: updatePrimaryLink(existing, nextPrimaryUrl),
            sourcePayload: nextSourcePayload,
          };

          allItems[existingIndex] = updatedItem;
          run.updatedCount += 1;
          itemResults.push({
            externalSourceId: video.externalSourceId,
            status: "updated",
            contentItemId: updatedItem.id,
            mappingConfidence: nextMapping.confidence,
            automationReviewState: nextAutomationDecision.reviewState,
            automationPublishDecision: nextAutomationDecision.publishDecision,
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

      const linkedContentItemIdByVideoId = new Map<string, string>();
      for (const item of allItems) {
        if (
          item.sourceType === "imported" &&
          typeof item.externalSourceId === "string" &&
          item.externalSourceId.trim().length > 0
        ) {
          linkedContentItemIdByVideoId.set(item.externalSourceId, item.id);
        }
      }
      let playlistPersistence: { syncedAt: string; playlistCount: number; playlistItemCount: number };
      try {
        playlistPersistence = await persistPlaylistsToLocalStore({
          source,
        playlists: playlistSyncResult.playlists,
        linkedContentItemIdByVideoId,
        syncedAt: now,
        syncMode: playlistSyncResult.mode,
      });
      } catch (playlistError) {
        playlistPersistence = {
          syncedAt: now,
          playlistCount: 0,
          playlistItemCount: 0,
        };
        console.warn("[seed-repo] playlist sync failed", playlistError);
      }

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
            isCanonicalYouTubeChannelId(refreshedSourceChannels[refreshedSourceIndex].externalChannelId)
              ? refreshedSourceChannels[refreshedSourceIndex].externalChannelId
              : resolved.channelId,
          lastSyncedAt: finishedAt,
          lastSuccessfulSyncAt:
            run.status === "success" || run.status === "partial_success"
              ? finishedAt
              : refreshedSourceChannels[refreshedSourceIndex].lastSuccessfulSyncAt ?? null,
          lastErrorAt: run.status === "failed" ? finishedAt : null,
          lastErrorMessage:
            run.status === "failed" ? run.errorMessage ?? "Ingestion failed" : null,
          lastPlaylistSyncedAt: playlistPersistence.syncedAt,
          lastPlaylistCount: playlistPersistence.playlistCount,
          lastPlaylistItemCount: playlistPersistence.playlistItemCount,
          playlistSyncMode: playlistSyncResult.mode,
          playlistSyncMessage: playlistSyncResult.message,
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

  async getCommentById(commentId: string) {
    const comments = await readLocalFallbackComments();
    return comments.find((comment) => comment.id === commentId) ?? null;
  }

  async createComment(input: CreateCommentInput) {
    const items = await readLocalFallbackContentItems();
    const targetItem = items.find((item) => item.id === input.contentItemId);
    if (!targetItem) {
      throw new Error("Content item for comment was not found.");
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
      throw new Error("Too many requests. Wait a few seconds and retry.");
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
      status: input.initialStatus ?? "pending",
      moderationStatus: input.initialModerationStatus ?? "pending_review",
      moderationReason: input.initialModerationReason ?? "Awaiting initial moderation review.",
      authorReputationCoefficient: input.authorReputationCoefficient ?? null,
      trustDecision: input.trustDecision ?? null,
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
      throw new Error("Comment was not found.");
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

  async listCommentFeedbackForCommentIds(commentIds: string[]) {
    if (commentIds.length === 0) {
      return [];
    }

    const commentIdSet = new Set(commentIds);
    const feedback = await readLocalFallbackCommentFeedback();
    return feedback.filter((entry) => commentIdSet.has(entry.commentId));
  }

  async upsertCommentFeedback(input: UpsertCommentFeedbackInput): Promise<UpsertCommentFeedbackResult> {
    const actorFingerprint = input.actorFingerprint.trim();
    if (!actorFingerprint) {
      throw new Error("Temporary identity fingerprint is required for comment feedback.");
    }

    const now = new Date().toISOString();
    const feedback = await readLocalFallbackCommentFeedback();
    const matchesActor = (entry: CommentFeedbackRecord) =>
      entry.commentId === input.commentId &&
      ((input.actorUserId && entry.actorUserId === input.actorUserId) ||
        entry.actorFingerprint === actorFingerprint);
    const existing = feedback.find((entry) => matchesActor(entry)) ?? null;

    if (existing && existing.feedbackType === input.feedbackType) {
      const next = feedback.filter((entry) => entry.id !== existing.id);
      await writeLocalFallbackCommentFeedback(next);
      return {
        action: "removed",
        feedback: null,
      };
    }

    if (existing) {
      const updated: CommentFeedbackRecord = {
        ...existing,
        feedbackType: input.feedbackType,
        actorUserId: input.actorUserId ?? null,
        actorFingerprint,
        updatedAt: now,
      };
      const next = feedback.map((entry) => (entry.id === existing.id ? updated : entry));
      await writeLocalFallbackCommentFeedback(next);
      return {
        action: "updated",
        feedback: updated,
      };
    }

    const created: CommentFeedbackRecord = {
      id: `comment-feedback-${randomUUID()}`,
      commentId: input.commentId,
      contentItemId: input.contentItemId,
      feedbackType: input.feedbackType,
      actorUserId: input.actorUserId ?? null,
      actorFingerprint,
      createdAt: now,
      updatedAt: now,
    };

    await writeLocalFallbackCommentFeedback([...feedback, created]);
    return {
      action: "created",
      feedback: created,
    };
  }

  async getAuthorCommentReputation(input: {
    authorUserId?: string | null;
    authorFingerprint?: string | null;
  }) {
    const comments = await readLocalFallbackComments();
    const feedback = await readLocalFallbackCommentFeedback();
    return buildAuthorReputationFromLocalRecords({
      comments,
      feedback,
      authorUserId: input.authorUserId,
      authorFingerprint: input.authorFingerprint,
    });
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

