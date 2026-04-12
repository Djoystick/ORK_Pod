import { randomUUID } from "node:crypto";

import "server-only";

import { buildCommentAuthorReputation } from "@/lib/comment-reputation";
import { resolveContentItems, sortItemsByDate } from "@/lib/content";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchYouTubeChannelVideos,
  type NormalizedYouTubeVideo,
} from "@/server/services/youtube-ingestion-service";
import type {
  CommentAuthorReputation,
  CommentFeedbackRecord,
  CommentFeedbackType,
  CommentRecord,
  CommentStatus,
  ContentItem,
  ContentStatus,
  CoverAsset,
  CreateCommentInput,
  CreateManualContentInput,
  CreateSourceChannelInput,
  ExternalLink,
  ImportRun,
  ImportRunItemResult,
  ImportRunTrigger,
  ImportStatus,
  ModerationStatus,
  ReactionRecord,
  ResolvedSourceChannel,
  SourceChannel,
  UpdateCommentModerationInput,
  UpdateContentItemInput,
  UpsertCommentFeedbackInput,
  UpsertCommentFeedbackResult,
  UpsertReactionInput,
  UpsertReactionResult,
} from "@/types/content";
import type { ContentRepository } from "@/types/repository";

type DbContentItemRow = {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  series_id: string | null;
  platform_id: string;
  source_type: "manual" | "imported";
  content_source_id: string | null;
  external_source_id: string | null;
  import_status: ImportStatus;
  status: "draft" | "published" | "archived";
  moderation_status: ModerationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  duration_minutes: number;
  excerpt: string;
  description: string;
  body: string | null;
  cover: unknown;
  source_payload: Record<string, unknown> | null;
  featured: boolean;
};

type DbExternalLinkRow = {
  id?: string;
  content_item_id: string;
  link_kind: ExternalLink["kind"];
  label: string;
  url: string;
  is_primary?: boolean;
};

type DbContentItemTagRow = {
  content_item_id: string;
  tag_id: string;
};

type DbSourceChannelRow = {
  id: string;
  slug: string;
  title: string;
  platform_id: string;
  external_channel_id: string | null;
  source_url: string | null;
  is_active: boolean | null;
  notes: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DbCommentRow = {
  id: string;
  content_item_id: string;
  parent_id: string | null;
  identity_mode: string | null;
  author_user_id: string | null;
  author_display: string;
  author_fingerprint: string | null;
  body: string;
  status: CommentStatus;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  author_reputation_coefficient: number | null;
  trust_decision: CommentRecord["trustDecision"];
  created_at: string;
  updated_at: string;
};

type DbCommentFeedbackRow = {
  id: string;
  comment_id: string;
  content_item_id: string;
  feedback_type: CommentFeedbackType;
  actor_user_id: string | null;
  actor_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

type DbReactionRow = {
  id: string;
  content_item_id: string;
  reaction_type: ReactionRecord["reactionType"];
  actor_user_id: string | null;
  actor_fingerprint: string | null;
  created_at: string;
};

type DbImportRunRow = {
  id: string;
  source_channel_id: string;
  status: ImportRun["status"];
  started_at: string;
  finished_at: string | null;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  error_message: string | null;
  trigger: ImportRunTrigger | null;
  parent_run_id: string | null;
  request_key: string | null;
  lock_acquired_at: string | null;
  lock_released_at: string | null;
  source_channels?: { id: string; slug: string; title: string } | Array<{
    id: string;
    slug: string;
    title: string;
  }> | null;
};

type DbImportRunItemRow = {
  import_run_id: string;
  external_source_id: string;
  content_item_id: string | null;
  status: ImportRunItemResult["status"];
  message: string | null;
};

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

const fallbackPalettes: Array<[string, string]> = [
  ["#1D4ED8", "#0F172A"],
  ["#0F766E", "#022C22"],
  ["#7C3AED", "#0F172A"],
  ["#0369A1", "#111827"],
  ["#BE123C", "#1F2937"],
];

const DEFAULT_IMPORTED_STATUS: ContentStatus = "draft";

const categoryKeywordRules: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: "community",
    keywords: [
      "q&a",
      "qna",
      "community",
      "question",
      "discussion",
      "chat",
      "сообщество",
      "комьюнити",
      "вопрос",
      "ответ",
      "дискуссия",
      "обсуждение",
    ],
  },
  {
    slug: "practice",
    keywords: [
      "live build",
      "tooling",
      "lab",
      "tutorial",
      "how to",
      "obs",
      "practice",
      "guide",
      "практика",
      "инструмент",
      "гайд",
      "лаборатория",
      "сборка",
      "автоматизация",
    ],
  },
  {
    slug: "interview",
    keywords: [
      "inside stream",
      "interview",
      "guest",
      "conversation",
      "podcast",
      "интервью",
      "гость",
      "беседа",
      "разговор",
      "подкаст",
    ],
  },
  {
    slug: "analysis",
    keywords: [
      "retro air",
      "archive notes",
      "analysis",
      "review",
      "metrics",
      "аналитика",
      "анализ",
      "разбор",
      "обзор",
      "метрики",
      "архив",
      "итоги",
    ],
  },
];

const seriesKeywordRules: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: "inside-stream",
    keywords: ["inside stream", "interview", "conversation", "интервью", "беседа"],
  },
  {
    slug: "retro-air",
    keywords: ["retro air", "retrospective", "review", "ретро", "обзор", "разбор"],
  },
  {
    slug: "live-build",
    keywords: ["live build", "build", "practice", "сборка", "практика"],
  },
  {
    slug: "qna-room",
    keywords: ["q&a", "qna", "question", "answers", "community", "вопрос", "ответ"],
  },
  {
    slug: "archive-notes",
    keywords: ["archive notes", "archive", "notes", "архив", "заметки"],
  },
  {
    slug: "tooling-lab",
    keywords: ["tooling", "lab", "tool", "obs", "automation", "инструмент", "автоматизация"],
  },
];

const tagKeywordRules: Record<string, string[]> = {
  nextjs: ["next.js", "nextjs", "app router", "next"],
  streaming: ["stream", "streaming", "broadcast", "стрим", "эфир"],
  editorial: ["editorial", "editing", "editor", "редактура", "монтаж"],
  community: ["community", "q&a", "qna", "комьюнити", "сообщество"],
  ux: ["ux", "ui", "interface", "интерфейс"],
  analytics: ["analytics", "metrics", "retention", "аналитика", "метрики"],
  obs: ["obs", "open broadcaster", "обс"],
  audio: ["audio", "sound", "microphone", "аудио", "звук", "микрофон"],
  automation: ["automation", "pipeline", "workflow", "автоматизация", "pipeline"],
  typescript: ["typescript", "type script", "ts"],
  archive: ["archive", "catalog", "library", "архив", "каталог"],
  process: ["process", "workflow", "flow", "процесс", "поток"],
};

const sourceAutomationProfiles: Record<string, SourceAutomationProfile> = {
  orkcut: {
    preferredCategorySlug: "practice",
    preferredSeriesSlug: "tooling-lab",
    preferredTagSlugs: ["automation", "process", "obs"],
    keywordBoosts: ["tooling", "pipeline", "workflow", "автоматизация", "практика"],
  },
  orkstream: {
    preferredCategorySlug: "community",
    preferredSeriesSlug: "qna-room",
    preferredTagSlugs: ["community", "streaming"],
    keywordBoosts: ["community", "q&a", "чат", "вопрос"],
  },
  "orkpod-youtube": {
    preferredCategorySlug: "analysis",
    preferredSeriesSlug: "archive-notes",
    preferredTagSlugs: ["archive", "analytics"],
    keywordBoosts: ["archive", "review", "метрики", "анализ"],
  },
};

const lowSignalSourceTags = new Set([
  "video",
  "videos",
  "youtube",
  "stream",
  "shorts",
  "dela",
  "ladda upp",
  "gratis",
  "kameratelefon",
  "videotelefon",
]);

type TaxonomySnapshot = Awaited<ReturnType<ContentRepository["listTaxonomy"]>>;

type PersistedImportItemMessagePayload = {
  message?: string;
  mappingConfidence?: ImportRunItemResult["mappingConfidence"];
  automationReviewState?: ImportRunItemResult["automationReviewState"];
  automationPublishDecision?: ImportRunItemResult["automationPublishDecision"];
};

function pickPalette(seed: string): [string, string] {
  const score = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackPalettes[score % fallbackPalettes.length];
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

function ensureUniqueSlug(
  registry: Array<{ id: string; slug: string }>,
  preferredSlug: string,
  itemId?: string,
) {
  const normalized = preferredSlug.trim();
  if (!normalized) {
    return `import-${randomUUID().slice(0, 8)}`;
  }

  const isTaken = (slug: string) =>
    registry.some((item) => item.slug === slug && (!itemId || item.id !== itemId));

  if (!isTaken(normalized)) {
    return normalized;
  }

  let suffix = 2;
  while (isTaken(`${normalized}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalized}-${suffix}`;
}

function chooseDefaultImportedCategoryId(taxonomy: TaxonomySnapshot) {
  return (
    taxonomy.categories.find((entry) => entry.slug === "analysis")?.id ??
    taxonomy.categories[0]?.id ??
    ""
  );
}

function chooseDefaultImportedSeriesId(taxonomy: TaxonomySnapshot, categoryId: string) {
  const categorySeries = taxonomy.series.filter((entry) => entry.categoryId === categoryId);
  const preferred = categorySeries.find((entry) => entry.slug === "archive-notes");
  return preferred?.id ?? categorySeries[0]?.id ?? null;
}

function isCanonicalYouTubeChannelId(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^UC[\w-]{22}$/.test(value.trim());
}

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
      typeof ingestion?.dataAcquisitionPath === "string" ? ingestion.dataAcquisitionPath : null,
    youtubeDataApiUsed: ingestion?.youtubeDataApiUsed === true,
    sourceTagsExact: ingestion?.sourceTagsExact === true,
    metadataSources,
  };
}

function parseMetadataReliability(value: unknown): MetadataReliability | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
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
    ? qualityPayload.missingCriticalFields.filter(
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

  return {
    overallReliability,
    missingCriticalFields,
    reasonCodes: deduplicateCaseInsensitive([
      `metadata:overall:${overallReliability}`,
      ...missingCriticalFields.map((field) => `metadata:missing:${field}`),
    ]),
  };
}

function buildAutoMappingResult(params: {
  video: NormalizedYouTubeVideo;
  source: SourceChannel;
  taxonomy: TaxonomySnapshot;
  defaultCategoryId: string;
  defaultSeriesId: string | null;
  metadataSignals?: MetadataSignals;
}) {
  const metadataSignals = params.metadataSignals ?? readMetadataSignals(params.video);
  const sourceProfile = sourceAutomationProfiles[params.source.slug] ?? null;
  const sourceProfileBoostTerms = sourceProfile?.keywordBoosts ?? [];

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
    ...sourceProfileBoostTerms,
  ].join(" ");
  const titleOnly = [params.video.title, params.video.sourceCategory ?? ""].join(" ");

  const defaultCategory =
    params.taxonomy.categories.find((entry) => entry.id === params.defaultCategoryId) ??
    params.taxonomy.categories.find((entry) => entry.slug === "analysis") ??
    params.taxonomy.categories[0];
  if (!defaultCategory) {
    throw new Error("Taxonomy categories are not configured for ingestion.");
  }

  let selectedCategory = defaultCategory;
  let selectedCategorySignal = {
    score: sourceProfile?.preferredCategorySlug === defaultCategory.slug ? 3 : 0,
    allMatches: [] as string[],
    titleMatches: [] as string[],
  };

  for (const rule of categoryKeywordRules) {
    const category = params.taxonomy.categories.find((entry) => entry.slug === rule.slug);
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

  const categorySeries = params.taxonomy.series.filter(
    (entry) => entry.categoryId === selectedCategory.id,
  );
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
  const tagCandidateEntries = params.taxonomy.tags
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
          params.taxonomy.tags
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
    ...listKeywordMatches(searchable, sourceProfileBoostTerms),
  ]);

  const score =
    selectedCategorySignal.score +
    selectedSeriesSignal.score +
    (resolvedTagIds.length >= 3 ? 4 : resolvedTagIds.length > 0 ? 2 : 0) +
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
    tagCandidateEntries.some((entry) => entry.totalScore >= 4);

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
    (resolvedTagIds.length === 0 && !exactSourceTags);
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
      `semantic_signals:${hasStrongSemanticSignals ? "strong" : "weak"}`,
      sourceProfile ? `source_profile:${params.source.slug}` : "source_profile:none",
      `metadata_reliability:${metadataSignals.overallReliability}`,
      ...metadataSignals.reasonCodes,
      fallbackUsed ? "fallback:manual_review_recommended" : "fallback:none",
    ]),
    matchedTerms: mappedTerms,
  } satisfies AutoMappingResult;
}

function deriveThumbnailCover(video: NormalizedYouTubeVideo): CoverAsset {
  if (video.thumbnailUrl) {
    return {
      kind: "image",
      alt: video.title,
      src: video.thumbnailUrl,
      palette: pickPalette(video.externalSourceId),
    };
  }

  return {
    kind: "gradient",
    alt: video.title,
    palette: pickPalette(video.externalSourceId),
  };
}

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

function isAutoPublishEnabled() {
  const raw = (process.env.YOUTUBE_INGESTION_ENABLE_AUTOPUBLISH ?? "false")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
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

function buildSourcePayload(params: {
  existing?: Record<string, unknown> | null;
  source: SourceChannel;
  video: NormalizedYouTubeVideo;
  mapping: AutoMappingResult;
  automationDecision: AutomationDecision;
  snapshot: ImportSnapshot;
  syncedAt: string;
}) {
  return {
    ...(params.existing ?? {}),
    ingestion: {
      provider: "youtube_rss",
      sourceSlug: params.source.slug,
      externalSourceId: params.video.externalSourceId,
      syncedAt: params.syncedAt,
      sourceChannelId: params.video.sourceChannelId,
      sourceChannelTitle: params.video.sourceChannelTitle,
      sourceCategory: params.video.sourceCategory,
      sourceTags: params.video.sourceTags,
      mappingConfidence: params.mapping.confidence,
      mappingNeedsReview: params.mapping.needsReview,
      mappingFallbackUsed: params.mapping.fallbackUsed,
      mappingScore: params.mapping.score,
      metadataReliability: params.mapping.metadataReliability,
      publishDecision: params.automationDecision.publishDecision,
      reviewState: params.automationDecision.reviewState,
      ...(params.video.sourcePayload.ingestion && typeof params.video.sourcePayload.ingestion === "object"
        ? (params.video.sourcePayload.ingestion as Record<string, unknown>)
        : {}),
    },
    mapping: {
      categoryId: params.mapping.categoryId,
      categorySlug: params.mapping.categorySlug,
      seriesId: params.mapping.seriesId,
      seriesSlug: params.mapping.seriesSlug,
      tagIds: params.mapping.tagIds,
      score: params.mapping.score,
      confidence: params.mapping.confidence,
      metadataReliability: params.mapping.metadataReliability,
      needsReview: params.mapping.needsReview,
      fallbackUsed: params.mapping.fallbackUsed,
      reasonCodes: params.mapping.reasonCodes,
      matchedTerms: params.mapping.matchedTerms,
    },
    automation: {
      publishDecision: params.automationDecision.publishDecision,
      reviewState: params.automationDecision.reviewState,
      targetStatus: params.automationDecision.targetStatus,
      autoPublishEnabled: params.automationDecision.autoPublishEnabled,
      autoPublishApplied: params.automationDecision.autoPublishApplied,
      metadataReliability: params.automationDecision.metadataReliability,
      reasonCodes: params.automationDecision.reasonCodes,
      decidedAt: params.syncedAt,
    },
    ingestionSnapshot: {
      ...params.snapshot,
      syncedAt: params.syncedAt,
    },
    raw: (params.video.sourcePayload.raw as Record<string, unknown> | undefined) ?? null,
  };
}

function summarizeRunStatus(params: Pick<
  ImportRun,
  "createdCount" | "updatedCount" | "skippedCount" | "failedCount"
>): ImportRun["status"] {
  const successful = params.createdCount + params.updatedCount + params.skippedCount;
  if (params.failedCount === 0) {
    return "success";
  }

  if (successful > 0) {
    return "partial_success";
  }

  return "failed";
}

function encodeImportRunItemMessage(item: ImportRunItemResult) {
  const payload: PersistedImportItemMessagePayload = {
    message: item.message,
    mappingConfidence: item.mappingConfidence,
    automationReviewState: item.automationReviewState,
    automationPublishDecision: item.automationPublishDecision,
  };

  const hasMeta =
    payload.mappingConfidence ||
    payload.automationReviewState ||
    payload.automationPublishDecision;
  if (!hasMeta) {
    return payload.message ?? null;
  }

  return JSON.stringify(payload);
}

function decodeImportRunItemMessage(raw: string | null) {
  if (!raw) {
    return {
      message: undefined,
      mappingConfidence: undefined,
      automationReviewState: undefined,
      automationPublishDecision: undefined,
    };
  }

  try {
    const parsed = JSON.parse(raw) as PersistedImportItemMessagePayload;
    return {
      message: typeof parsed.message === "string" ? parsed.message : undefined,
      mappingConfidence:
        parsed.mappingConfidence === "high" ||
        parsed.mappingConfidence === "medium" ||
        parsed.mappingConfidence === "low"
          ? parsed.mappingConfidence
          : undefined,
      automationReviewState:
        parsed.automationReviewState === "review_needed" ||
        parsed.automationReviewState === "review_light" ||
        parsed.automationReviewState === "auto_published"
          ? parsed.automationReviewState
          : undefined,
      automationPublishDecision:
        parsed.automationPublishDecision === "keep_draft" ||
        parsed.automationPublishDecision === "review_required" ||
        parsed.automationPublishDecision === "auto_publish"
          ? parsed.automationPublishDecision
          : undefined,
    };
  } catch {
    return {
      message: raw,
      mappingConfidence: undefined,
      automationReviewState: undefined,
      automationPublishDecision: undefined,
    };
  }
}

function resolveJoinedSourceChannel(
  source: DbImportRunRow["source_channels"],
): { id: string; slug: string; title: string } | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    return source[0] ?? null;
  }
  return source;
}

function mapImportRunRow(params: {
  row: DbImportRunRow;
  sourceFallback?: { id: string; slug: string; title: string } | null;
  itemRows: DbImportRunItemRow[];
}) {
  const source = resolveJoinedSourceChannel(params.row.source_channels) ?? params.sourceFallback;

  return {
    id: params.row.id,
    sourceChannelId: params.row.source_channel_id,
    sourceChannelSlug: source?.slug ?? "unknown-source",
    sourceChannelTitle: source?.title ?? "Unknown source",
    trigger: params.row.trigger ?? "sync_source",
    parentRunId: params.row.parent_run_id,
    requestKey: params.row.request_key,
    status: params.row.status,
    startedAt: params.row.started_at,
    finishedAt: params.row.finished_at,
    lockAcquiredAt: params.row.lock_acquired_at,
    lockReleasedAt: params.row.lock_released_at,
    createdCount: params.row.created_count,
    updatedCount: params.row.updated_count,
    skippedCount: params.row.skipped_count,
    failedCount: params.row.failed_count,
    errorMessage: params.row.error_message,
    itemResults: params.itemRows.map((itemRow) => {
      const decoded = decodeImportRunItemMessage(itemRow.message);
      return {
        externalSourceId: itemRow.external_source_id,
        status: itemRow.status,
        contentItemId: itemRow.content_item_id ?? undefined,
        message: decoded.message,
        mappingConfidence: decoded.mappingConfidence,
        automationReviewState: decoded.automationReviewState,
        automationPublishDecision: decoded.automationPublishDecision,
      } satisfies ImportRunItemResult;
    }),
  } satisfies ImportRun;
}

function ensureClient() {
  const client = createSupabaseServiceClient();

  if (!client) {
    throw new Error("Supabase service config is not available");
  }

  return client;
}

function ensureValidUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error("Некорректный внешний URL");
  }
}

function toCoverAsset(value: unknown, title: string): CoverAsset {
  if (typeof value === "object" && value !== null) {
    const cover = value as Partial<CoverAsset>;

    if (
      Array.isArray(cover.palette) &&
      cover.palette.length === 2 &&
      typeof cover.palette[0] === "string" &&
      typeof cover.palette[1] === "string"
    ) {
      return {
        kind: cover.kind === "image" ? "image" : "gradient",
        alt: typeof cover.alt === "string" ? cover.alt : title,
        palette: [cover.palette[0], cover.palette[1]],
        src: typeof cover.src === "string" ? cover.src : undefined,
      };
    }
  }

  return {
    kind: "gradient",
    alt: title,
    palette: ["#1D4ED8", "#0F172A"],
  };
}

function rowToContentItem(
  row: DbContentItemRow,
  links: DbExternalLinkRow[],
  tagIds: string[],
): ContentItem {
  const orderedLinks = [...links].sort((left, right) => {
    const leftPriority = left.is_primary ? 1 : 0;
    const rightPriority = right.is_primary ? 1 : 0;
    return rightPriority - leftPriority;
  });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categoryId: row.category_id,
    seriesId: row.series_id,
    platformId: row.platform_id,
    sourceType: row.source_type,
    contentSourceId: row.content_source_id,
    externalSourceId: row.external_source_id,
    importStatus: row.import_status,
    status: row.status,
    moderationStatus: row.moderation_status,
    tagIds,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationMinutes: row.duration_minutes,
    excerpt: row.excerpt,
    description: row.description,
    body: row.body ?? undefined,
    cover: toCoverAsset(row.cover, row.title),
    links: orderedLinks.map((link) => ({
      kind: link.link_kind,
      label: link.label,
      url: link.url,
    })),
    sourcePayload: row.source_payload,
    featured: row.featured,
  };
}

const commentSelectColumns =
  "id, content_item_id, parent_id, identity_mode, author_user_id, author_display, author_fingerprint, body, status, moderation_status, moderation_reason, author_reputation_coefficient, trust_decision, created_at, updated_at";

const commentFeedbackSelectColumns =
  "id, comment_id, content_item_id, feedback_type, actor_user_id, actor_fingerprint, created_at, updated_at";

function rowToComment(row: DbCommentRow): CommentRecord {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    parentId: row.parent_id,
    identityMode:
      row.identity_mode === "guest_cookie_v1" ? row.identity_mode : "guest_cookie_v1",
    authorUserId: row.author_user_id,
    authorDisplay: row.author_display,
    authorFingerprint: row.author_fingerprint,
    body: row.body,
    status: row.status,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason,
    authorReputationCoefficient: row.author_reputation_coefficient,
    trustDecision: row.trust_decision ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCommentFeedback(row: DbCommentFeedbackRow): CommentFeedbackRecord {
  return {
    id: row.id,
    commentId: row.comment_id,
    contentItemId: row.content_item_id,
    feedbackType: row.feedback_type,
    actorUserId: row.actor_user_id,
    actorFingerprint: row.actor_fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReaction(row: DbReactionRow): ReactionRecord {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    reactionType: row.reaction_type,
    actorUserId: row.actor_user_id,
    actorFingerprint: row.actor_fingerprint,
    createdAt: row.created_at,
  };
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

function resolveCommentAuthorKey(input: {
  authorUserId?: string | null;
  authorFingerprint?: string | null;
}) {
  const authorUserId = input.authorUserId?.trim() ?? "";
  if (authorUserId) {
    return { mode: "user" as const, value: authorUserId };
  }

  const authorFingerprint = input.authorFingerprint?.trim() ?? "";
  if (authorFingerprint) {
    return { mode: "fingerprint" as const, value: authorFingerprint };
  }

  return null;
}

export class SupabaseContentRepository implements ContentRepository {
  async listTaxonomy() {
    const client = ensureClient();

    const [categoriesResult, seriesResult, platformsResult, tagsResult] = await Promise.all([
      client.from("categories").select("id, slug, title, description").order("title"),
      client
        .from("series")
        .select("id, slug, category_id, title, description")
        .order("title"),
      client.from("platforms").select("id, slug, title, kind, base_url").order("title"),
      client.from("tags").select("id, slug, label").order("label"),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (seriesResult.error) throw seriesResult.error;
    if (platformsResult.error) throw platformsResult.error;
    if (tagsResult.error) throw tagsResult.error;

    return {
      categories: (categoriesResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description ?? "",
      })),
      series: (seriesResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        categoryId: row.category_id,
        title: row.title,
        description: row.description ?? "",
      })),
      platforms: (platformsResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        kind: row.kind,
        baseUrl: row.base_url,
      })),
      tags: tagsResult.data ?? [],
    };
  }

  private async listItemsByCondition(condition?: {
    field: string;
    value: string;
  }) {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();

    let query = client.from("content_items").select("*");
    if (condition) {
      query = query.eq(condition.field, condition.value);
    }

    const itemsResult = await query.order("published_at", { ascending: false });
    if (itemsResult.error) throw itemsResult.error;

    const itemRows = (itemsResult.data ?? []) as DbContentItemRow[];
    if (itemRows.length === 0) {
      return [];
    }

    const itemIds = itemRows.map((row) => row.id);

    const [linksResult, tagsResult] = await Promise.all([
      client
        .from("external_links")
        .select("id, content_item_id, link_kind, label, url, is_primary")
        .in("content_item_id", itemIds),
      client
        .from("content_item_tags")
        .select("content_item_id, tag_id")
        .in("content_item_id", itemIds),
    ]);

    if (linksResult.error) throw linksResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const linksByItem = new Map<string, DbExternalLinkRow[]>();
    const tagIdsByItem = new Map<string, string[]>();

    for (const row of (linksResult.data ?? []) as DbExternalLinkRow[]) {
      const next = linksByItem.get(row.content_item_id) ?? [];
      next.push(row);
      linksByItem.set(row.content_item_id, next);
    }

    for (const row of (tagsResult.data ?? []) as DbContentItemTagRow[]) {
      const next = tagIdsByItem.get(row.content_item_id) ?? [];
      next.push(row.tag_id);
      tagIdsByItem.set(row.content_item_id, next);
    }

    const mappedItems = itemRows.map((row) =>
      rowToContentItem(row, linksByItem.get(row.id) ?? [], tagIdsByItem.get(row.id) ?? []),
    );

    return resolveContentItems(mappedItems, taxonomy);
  }

  async listArchiveItems() {
    const allItems = await this.listItemsByCondition({ field: "status", value: "published" });
    return sortItemsByDate(allItems, "newest");
  }

  async listAdminContentItems() {
    const allItems = await this.listItemsByCondition();
    return sortItemsByDate(allItems, "newest");
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
    const client = ensureClient();
    const now = new Date().toISOString();
    const taxonomy = await this.listTaxonomy();

    const category = taxonomy.categories.find((entry) => entry.slug === input.categorySlug);
    if (!category) throw new Error("Категория не найдена");

    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");

    const series = input.seriesSlug
      ? taxonomy.series.find((entry) => entry.slug === input.seriesSlug)
      : null;
    if (input.seriesSlug && !series) throw new Error("Серия не найдена");
    if (series && series.categoryId !== category.id) {
      throw new Error("Серия не принадлежит выбранной категории");
    }

    const duplicateCheck = await client
      .from("content_items")
      .select("id")
      .eq("slug", input.slug)
      .limit(1)
      .maybeSingle();
    if (duplicateCheck.error) throw duplicateCheck.error;
    if (duplicateCheck.data?.id) throw new Error("Слаг уже существует");

    const sourceResult = await client
      .from("content_sources")
      .insert({
        source_type: "manual",
        import_status: "not_applicable",
        external_source_id: null,
        source_payload: null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (sourceResult.error) throw sourceResult.error;

    const itemResult = await client
      .from("content_items")
      .insert({
        slug: input.slug,
        title: input.title,
        category_id: category.id,
        series_id: series?.id ?? null,
        platform_id: platform.id,
        source_type: "manual",
        content_source_id: sourceResult.data.id,
        external_source_id: null,
        import_status: "not_applicable",
        status: input.status,
        moderation_status: "clean",
        published_at: getPublishedAtForStatus({
          requested: input.publishedAt,
          previous: null,
          status: input.status,
          now,
        }),
        created_at: now,
        updated_at: now,
        duration_minutes: 0,
        excerpt: input.excerpt,
        description: input.description,
        body: input.body ?? null,
        cover: {
          kind: "gradient",
          alt: input.title,
          palette: ["#1D4ED8", "#0F172A"],
        },
        source_payload: null,
        featured: false,
      })
      .select("id, slug")
      .single();
    if (itemResult.error) throw itemResult.error;

    const linkResult = await client.from("external_links").insert({
      content_item_id: itemResult.data.id,
      link_kind: platform.slug === "youtube" ? "youtube" : "video",
      label: "Открыть оригинал",
      url: ensureValidUrl(input.externalUrl),
      is_primary: true,
      created_at: now,
    });
    if (linkResult.error) throw linkResult.error;

    return { id: itemResult.data.id, slug: itemResult.data.slug };
  }

  async updateContentItem(input: UpdateContentItemInput) {
    const client = ensureClient();
    const now = new Date().toISOString();
    const taxonomy = await this.listTaxonomy();

    const category = taxonomy.categories.find((entry) => entry.slug === input.categorySlug);
    if (!category) throw new Error("Категория не найдена");
    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");
    const series = input.seriesSlug
      ? taxonomy.series.find((entry) => entry.slug === input.seriesSlug)
      : null;
    if (input.seriesSlug && !series) throw new Error("Серия не найдена");
    if (series && series.categoryId !== category.id) {
      throw new Error("Серия не принадлежит выбранной категории");
    }

    const duplicateCheck = await client
      .from("content_items")
      .select("id")
      .eq("slug", input.slug)
      .neq("id", input.id)
      .limit(1)
      .maybeSingle();
    if (duplicateCheck.error) throw duplicateCheck.error;
    if (duplicateCheck.data?.id) throw new Error("Слаг уже используется другой записью");

    const existingItemResult = await client
      .from("content_items")
      .select("published_at")
      .eq("id", input.id)
      .single();
    if (existingItemResult.error) throw existingItemResult.error;

    const itemResult = await client
      .from("content_items")
      .update({
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        description: input.description,
        body: input.body ?? null,
        category_id: category.id,
        series_id: series?.id ?? null,
        platform_id: platform.id,
        status: input.status,
        published_at: getPublishedAtForStatus({
          requested: input.publishedAt,
          previous: existingItemResult.data.published_at,
          status: input.status,
          now,
        }),
        updated_at: now,
      })
      .eq("id", input.id)
      .select("id, slug")
      .single();
    if (itemResult.error) throw itemResult.error;

    const externalUrl = ensureValidUrl(input.externalUrl);
    const existingPrimaryLink = await client
      .from("external_links")
      .select("id")
      .eq("content_item_id", input.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (existingPrimaryLink.error) throw existingPrimaryLink.error;

    if (existingPrimaryLink.data?.id) {
      const updateLink = await client
        .from("external_links")
        .update({
          url: externalUrl,
          label: "Открыть оригинал",
          link_kind: platform.slug === "youtube" ? "youtube" : "video",
        })
        .eq("id", existingPrimaryLink.data.id);
      if (updateLink.error) throw updateLink.error;
    } else {
      const insertLink = await client.from("external_links").insert({
        content_item_id: input.id,
        link_kind: platform.slug === "youtube" ? "youtube" : "video",
        label: "Открыть оригинал",
        url: externalUrl,
        is_primary: true,
        created_at: now,
      });
      if (insertLink.error) throw insertLink.error;
    }

    return {
      id: itemResult.data.id,
      slug: itemResult.data.slug,
    };
  }

  async setContentItemStatus(id: string, status: ContentStatus) {
    const client = ensureClient();
    const now = new Date().toISOString();

    const currentResult = await client
      .from("content_items")
      .select("published_at")
      .eq("id", id)
      .single();
    if (currentResult.error) throw currentResult.error;

    const result = await client
      .from("content_items")
      .update({
        status,
        updated_at: now,
        published_at:
          status === "published"
            ? currentResult.data.published_at ?? now
            : currentResult.data.published_at ?? now,
      })
      .eq("id", id)
      .select("id")
      .single();
    if (result.error) throw result.error;

    return { id: result.data.id, status };
  }

  async listCommentsForContentItem(
    contentItemId: string,
    options?: { statuses?: CommentStatus[] },
  ) {
    const client = ensureClient();

    let query = client
      .from("comments")
      .select(commentSelectColumns)
      .eq("content_item_id", contentItemId);

    if (options?.statuses && options.statuses.length > 0) {
      query = query.in("status", options.statuses);
    }

    const result = await query.order("created_at", { ascending: true });
    if (result.error) throw result.error;

    return ((result.data ?? []) as DbCommentRow[]).map(rowToComment);
  }

  async getCommentById(commentId: string) {
    const client = ensureClient();
    const result = await client
      .from("comments")
      .select(commentSelectColumns)
      .eq("id", commentId)
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) {
      return null;
    }

    return rowToComment(result.data as DbCommentRow);
  }

  async createComment(input: CreateCommentInput) {
    const client = ensureClient();
    const now = new Date().toISOString();
    const status = input.initialStatus ?? "pending";
    const moderationStatus = input.initialModerationStatus ?? "pending_review";
    const moderationReason = input.initialModerationReason ?? "Ожидает первичной модерации.";

    const result = await client
      .from("comments")
      .insert({
        content_item_id: input.contentItemId,
        parent_id: null,
        identity_mode: input.identityMode,
        author_user_id: input.authorUserId ?? null,
        author_display: input.authorDisplay.trim(),
        author_fingerprint: input.authorFingerprint.trim(),
        body: input.body.trim(),
        status,
        moderation_status: moderationStatus,
        moderation_reason: moderationReason,
        author_reputation_coefficient: input.authorReputationCoefficient ?? null,
        trust_decision: input.trustDecision ?? null,
        created_at: now,
        updated_at: now,
      })
      .select(commentSelectColumns)
      .single();

    if (result.error) throw result.error;
    return rowToComment(result.data as DbCommentRow);
  }

  async setCommentModeration(input: UpdateCommentModerationInput) {
    const client = ensureClient();

    const moderationStatus: ModerationStatus =
      input.status === "approved"
        ? "clean"
        : input.status === "pending"
          ? "pending_review"
          : "blocked";

    const result = await client
      .from("comments")
      .update({
        status: input.status,
        moderation_status: moderationStatus,
        moderation_reason: input.moderationReason?.trim() || null,
      })
      .eq("id", input.commentId)
      .select(commentSelectColumns)
      .single();

    if (result.error) throw result.error;
    return rowToComment(result.data as DbCommentRow);
  }

  async listModerationComments(filters?: {
    status?: CommentStatus | "all";
    q?: string;
    limit?: number;
  }) {
    const client = ensureClient();
    const status = filters?.status ?? "all";
    const q = (filters?.q ?? "").trim();
    const limit = filters?.limit ?? 150;

    let query = client
      .from("comments")
      .select(commentSelectColumns)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (q) {
      const escaped = q.replace(/,/g, " ");
      query = query.or(`author_display.ilike.%${escaped}%,body.ilike.%${escaped}%`);
    }

    const result = await query;
    if (result.error) throw result.error;
    return ((result.data ?? []) as DbCommentRow[]).map(rowToComment);
  }

  async listCommentFeedbackForCommentIds(commentIds: string[]) {
    if (commentIds.length === 0) {
      return [];
    }

    const client = ensureClient();
    const result = await client
      .from("comment_feedback")
      .select(commentFeedbackSelectColumns)
      .in("comment_id", commentIds);

    if (result.error) throw result.error;
    return ((result.data ?? []) as DbCommentFeedbackRow[]).map(rowToCommentFeedback);
  }

  async upsertCommentFeedback(
    input: UpsertCommentFeedbackInput,
  ): Promise<UpsertCommentFeedbackResult> {
    const client = ensureClient();
    const actorFingerprint = input.actorFingerprint.trim();
    if (!actorFingerprint) {
      throw new Error("Temporary identity fingerprint is required for comment feedback.");
    }

    const now = new Date().toISOString();
    const existingResult = await client
      .from("comment_feedback")
      .select(commentFeedbackSelectColumns)
      .eq("comment_id", input.commentId)
      .or(
        input.actorUserId
          ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
          : `actor_fingerprint.eq.${actorFingerprint}`,
      )
      .limit(1);
    if (existingResult.error) throw existingResult.error;

    const existing = ((existingResult.data ?? []) as DbCommentFeedbackRow[])[0] ?? null;

    if (existing && existing.feedback_type === input.feedbackType) {
      const deleteResult = await client.from("comment_feedback").delete().eq("id", existing.id);
      if (deleteResult.error) throw deleteResult.error;
      return {
        action: "removed",
        feedback: null,
      };
    }

    if (existing) {
      const updateResult = await client
        .from("comment_feedback")
        .update({
          feedback_type: input.feedbackType,
          actor_user_id: input.actorUserId ?? null,
          actor_fingerprint: actorFingerprint,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select(commentFeedbackSelectColumns)
        .single();
      if (updateResult.error) throw updateResult.error;

      return {
        action: "updated",
        feedback: rowToCommentFeedback(updateResult.data as DbCommentFeedbackRow),
      };
    }

    const insertResult = await client
      .from("comment_feedback")
      .insert({
        comment_id: input.commentId,
        content_item_id: input.contentItemId,
        feedback_type: input.feedbackType,
        actor_user_id: input.actorUserId ?? null,
        actor_fingerprint: actorFingerprint,
        created_at: now,
        updated_at: now,
      })
      .select(commentFeedbackSelectColumns)
      .single();
    if (insertResult.error) throw insertResult.error;

    return {
      action: "created",
      feedback: rowToCommentFeedback(insertResult.data as DbCommentFeedbackRow),
    };
  }

  async getAuthorCommentReputation(input: {
    authorUserId?: string | null;
    authorFingerprint?: string | null;
  }): Promise<CommentAuthorReputation> {
    const authorKey = resolveCommentAuthorKey(input);
    if (!authorKey) {
      return buildCommentAuthorReputation({
        totalPositive: 0,
        totalNegative: 0,
        totalComments: 0,
        ratedComments: 0,
      });
    }

    const client = ensureClient();
    let commentsQuery = client.from("comments").select("id");
    commentsQuery =
      authorKey.mode === "user"
        ? commentsQuery.eq("author_user_id", authorKey.value)
        : commentsQuery.eq("author_fingerprint", authorKey.value);

    const commentsResult = await commentsQuery;
    if (commentsResult.error) throw commentsResult.error;
    const commentIds = (commentsResult.data ?? []).map((row) => row.id as string);
    if (commentIds.length === 0) {
      return buildCommentAuthorReputation({
        totalPositive: 0,
        totalNegative: 0,
        totalComments: 0,
        ratedComments: 0,
      });
    }

    const feedbackResult = await client
      .from("comment_feedback")
      .select("comment_id, feedback_type")
      .in("comment_id", commentIds);
    if (feedbackResult.error) throw feedbackResult.error;

    const feedbackRows = (feedbackResult.data ?? []) as Array<{
      comment_id: string;
      feedback_type: CommentFeedbackType;
    }>;
    const totalPositive = feedbackRows.filter((row) => row.feedback_type === "up").length;
    const totalNegative = feedbackRows.filter((row) => row.feedback_type === "down").length;
    const ratedComments = new Set(feedbackRows.map((row) => row.comment_id)).size;

    return buildCommentAuthorReputation({
      totalPositive,
      totalNegative,
      totalComments: commentIds.length,
      ratedComments,
    });
  }

  async listReactionsForContentItem(contentItemId: string) {
    const client = ensureClient();
    const result = await client
      .from("reactions")
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .eq("content_item_id", contentItemId);

    if (result.error) throw result.error;
    return ((result.data ?? []) as DbReactionRow[]).map(rowToReaction);
  }

  async upsertReaction(input: UpsertReactionInput): Promise<UpsertReactionResult> {
    const client = ensureClient();
    const actorFingerprint = input.actorFingerprint.trim();
    if (!actorFingerprint) {
      throw new Error("Temporary identity fingerprint is required for reactions.");
    }

    const existingResult = await client
      .from("reactions")
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .eq("content_item_id", input.contentItemId)
      .or(
        input.actorUserId
          ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
          : `actor_fingerprint.eq.${actorFingerprint}`,
      );
    if (existingResult.error) throw existingResult.error;

    const existing = (existingResult.data ?? []) as DbReactionRow[];
    const hasSame = existing.some((row) => row.reaction_type === input.reactionType);

    if (hasSame) {
      const deleteResult = await client
        .from("reactions")
        .delete()
        .eq("content_item_id", input.contentItemId)
        .or(
          input.actorUserId
            ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
            : `actor_fingerprint.eq.${actorFingerprint}`,
        );
      if (deleteResult.error) throw deleteResult.error;
      return {
        action: "removed",
        reaction: null,
      };
    }

    if (existing.length > 0) {
      const deleteResult = await client
        .from("reactions")
        .delete()
        .eq("content_item_id", input.contentItemId)
        .or(
          input.actorUserId
            ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
            : `actor_fingerprint.eq.${actorFingerprint}`,
        );
      if (deleteResult.error) throw deleteResult.error;
    }

    const insertResult = await client
      .from("reactions")
      .insert({
        content_item_id: input.contentItemId,
        reaction_type: input.reactionType,
        actor_user_id: input.actorUserId ?? null,
        actor_fingerprint: actorFingerprint,
        created_at: new Date().toISOString(),
      })
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .single();
    if (insertResult.error) throw insertResult.error;

    return {
      action: existing.length > 0 ? "updated" : "created",
      reaction: rowToReaction(insertResult.data as DbReactionRow),
    };
  }

  async listSourceChannels() {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();
    const platformMap = new Map(taxonomy.platforms.map((platform) => [platform.id, platform]));

    const result = await client
      .from("source_channels")
      .select(
        "id, slug, title, platform_id, external_channel_id, source_url, is_active, notes, last_synced_at, last_successful_sync_at, last_error_at, last_error_message, created_at, updated_at",
      )
      .order("title");

    if (result.error) throw result.error;

    const channels = (result.data ?? []) as DbSourceChannelRow[];
    return channels
      .map((row): ResolvedSourceChannel | null => {
        const platform = platformMap.get(row.platform_id);
        if (!platform) return null;

        const channel: SourceChannel = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          platformId: row.platform_id,
          externalChannelId: row.external_channel_id,
          sourceUrl: row.source_url,
          isActive: row.is_active ?? true,
          notes: row.notes,
          lastSyncedAt: row.last_synced_at,
          lastSuccessfulSyncAt: row.last_successful_sync_at,
          lastErrorAt: row.last_error_at,
          lastErrorMessage: row.last_error_message,
          createdAt: row.created_at ?? undefined,
          updatedAt: row.updated_at ?? undefined,
        };

        return {
          ...channel,
          platform,
        };
      })
      .filter(isResolvedSourceChannel);
  }

  async createSourceChannel(input: CreateSourceChannelInput) {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();
    const now = new Date().toISOString();

    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");

    const sourceUrl = input.sourceUrl?.trim() ? ensureValidUrl(input.sourceUrl) : null;
    const externalChannelId = input.externalChannelId?.trim() || null;
    if (!sourceUrl && !externalChannelId) {
      throw new Error("Укажите URL канала или внешний channel id");
    }

    const duplicate = await client
      .from("source_channels")
      .select("id")
      .eq("slug", input.slug)
      .limit(1)
      .maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data?.id) throw new Error("Канал с таким slug уже существует");

    const result = await client
      .from("source_channels")
      .insert({
        slug: input.slug,
        title: input.title,
        platform_id: platform.id,
        external_channel_id: externalChannelId,
        source_url: sourceUrl,
        is_active: input.isActive,
        notes: input.notes?.trim() || null,
        last_synced_at: null,
        last_successful_sync_at: null,
        last_error_at: null,
        last_error_message: null,
        created_at: now,
        updated_at: now,
      })
      .select("id, slug")
      .single();

    if (result.error) throw result.error;
    return { id: result.data.id, slug: result.data.slug };
  }

  private async getImportRunByRequestKey(requestKey: string) {
    const client = ensureClient();
    const existing = await client
      .from("import_runs")
      .select("id")
      .eq("request_key", requestKey)
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data?.id) return null;
    return this.getImportRunById(existing.data.id);
  }

  private async listImportedItemsByExternalSourceIds(externalSourceIds: string[]) {
    const uniqueIds = [...new Set(externalSourceIds.filter((entry) => entry.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return [] as ContentItem[];
    }

    const client = ensureClient();
    const itemsResult = await client
      .from("content_items")
      .select("*")
      .eq("source_type", "imported")
      .in("external_source_id", uniqueIds);
    if (itemsResult.error) throw itemsResult.error;

    const itemRows = (itemsResult.data ?? []) as DbContentItemRow[];
    if (itemRows.length === 0) {
      return [] as ContentItem[];
    }

    const itemIds = itemRows.map((row) => row.id);
    const [linksResult, tagsResult] = await Promise.all([
      client
        .from("external_links")
        .select("id, content_item_id, link_kind, label, url, is_primary")
        .in("content_item_id", itemIds),
      client
        .from("content_item_tags")
        .select("content_item_id, tag_id")
        .in("content_item_id", itemIds),
    ]);

    if (linksResult.error) throw linksResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const linksByItem = new Map<string, DbExternalLinkRow[]>();
    const tagIdsByItem = new Map<string, string[]>();
    for (const row of (linksResult.data ?? []) as DbExternalLinkRow[]) {
      const next = linksByItem.get(row.content_item_id) ?? [];
      next.push(row);
      linksByItem.set(row.content_item_id, next);
    }
    for (const row of (tagsResult.data ?? []) as DbContentItemTagRow[]) {
      const next = tagIdsByItem.get(row.content_item_id) ?? [];
      next.push(row.tag_id);
      tagIdsByItem.set(row.content_item_id, next);
    }

    return itemRows.map((row) =>
      rowToContentItem(row, linksByItem.get(row.id) ?? [], tagIdsByItem.get(row.id) ?? []),
    );
  }

  private async persistImportRun(run: ImportRun) {
    const client = ensureClient();
    const runUpdate = await client
      .from("import_runs")
      .update({
        status: run.status,
        finished_at: run.finishedAt ?? null,
        created_count: run.createdCount,
        updated_count: run.updatedCount,
        skipped_count: run.skippedCount,
        failed_count: run.failedCount,
        error_message: run.errorMessage ?? null,
        lock_released_at: run.lockReleasedAt ?? null,
      })
      .eq("id", run.id);
    if (runUpdate.error) throw runUpdate.error;

    const deleteResult = await client.from("import_run_items").delete().eq("import_run_id", run.id);
    if (deleteResult.error) throw deleteResult.error;

    if (run.itemResults.length === 0) {
      return;
    }

    const rows = run.itemResults.map((item) => ({
      import_run_id: run.id,
      external_source_id: item.externalSourceId,
      content_item_id: item.contentItemId ?? null,
      status: item.status,
      message: encodeImportRunItemMessage(item),
      created_at: new Date().toISOString(),
    }));

    const upsertResult = await client
      .from("import_run_items")
      .upsert(rows, { onConflict: "import_run_id,external_source_id" });
    if (upsertResult.error) throw upsertResult.error;
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
  ): Promise<ImportRun> {
    const client = ensureClient();
    const trigger = options?.trigger ?? "sync_source";
    const scopedRequestKey = options?.requestKey
      ? `${options.requestKey}:${sourceId}`
      : null;

    if (scopedRequestKey) {
      const existingRun = await this.getImportRunByRequestKey(scopedRequestKey);
      if (existingRun) {
        return existingRun;
      }
    }

    const sources = await this.listSourceChannels();
    const source = sources.find((entry) => entry.id === sourceId);
    if (!source) {
      throw new Error("Источник не найден.");
    }

    const now = new Date().toISOString();
    const run: ImportRun = {
      id: randomUUID(),
      sourceChannelId: source.id,
      sourceChannelSlug: source.slug,
      sourceChannelTitle: source.title,
      trigger,
      parentRunId: options?.parentRunId ?? null,
      requestKey: scopedRequestKey,
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

    const insertRunResult = await client.from("import_runs").insert({
      id: run.id,
      source_channel_id: run.sourceChannelId,
      status: run.status,
      started_at: run.startedAt,
      finished_at: null,
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
      failed_count: 0,
      error_message: null,
      trigger: run.trigger,
      parent_run_id: run.parentRunId,
      request_key: run.requestKey,
      lock_acquired_at: run.lockAcquiredAt,
      lock_released_at: run.lockReleasedAt,
      created_at: now,
    });
    if (insertRunResult.error) {
      if (insertRunResult.error.code === "23505" && scopedRequestKey) {
        const existingRun = await this.getImportRunByRequestKey(scopedRequestKey);
        if (existingRun) {
          return existingRun;
        }
      }
      throw insertRunResult.error;
    }

    const syncStarted = await client
      .from("source_channels")
      .update({
        last_synced_at: now,
        last_error_at: null,
        last_error_message: null,
        updated_at: now,
      })
      .eq("id", source.id);
    if (syncStarted.error) throw syncStarted.error;

    try {
      if (source.platform.slug !== "youtube") {
        throw new Error("Ingestion currently supports only YouTube sources.");
      }

      const taxonomy = await this.listTaxonomy();
      const defaultCategoryId = chooseDefaultImportedCategoryId(taxonomy);
      if (!defaultCategoryId) {
        throw new Error("Taxonomy category defaults are not configured.");
      }
      const defaultSeriesId = chooseDefaultImportedSeriesId(taxonomy, defaultCategoryId);
      const { resolved, videos } = await fetchYouTubeChannelVideos(source);

      const filteredVideos =
        trigger === "retry_failed_items" &&
        Array.isArray(options?.retryExternalSourceIds) &&
        options.retryExternalSourceIds.length > 0
          ? videos.filter((video) => options.retryExternalSourceIds?.includes(video.externalSourceId))
          : videos;

      const existingImportedItems = await this.listImportedItemsByExternalSourceIds(
        filteredVideos.map((video) => video.externalSourceId),
      );
      const existingByExternalId = new Map(
        existingImportedItems
          .filter((item) => item.externalSourceId)
          .map((item) => [item.externalSourceId as string, item]),
      );

      const allSlugRowsResult = await client.from("content_items").select("id, slug");
      if (allSlugRowsResult.error) throw allSlugRowsResult.error;
      const slugRegistry = (allSlugRowsResult.data ?? []).map((entry) => ({
        id: entry.id as string,
        slug: entry.slug as string,
      }));

      const itemResults: ImportRunItemResult[] = [];

      for (const video of filteredVideos) {
        try {
          const metadataSignals = readMetadataSignals(video);
          const mapping = buildAutoMappingResult({
            video,
            source,
            taxonomy,
            defaultCategoryId,
            defaultSeriesId,
            metadataSignals,
          });

          const existing = existingByExternalId.get(video.externalSourceId) ?? null;
          if (!existing) {
            const slug = ensureUniqueSlug(slugRegistry, video.slug);
            slugRegistry.push({ id: `pending-${randomUUID()}`, slug });
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
            const sourcePayload = buildSourcePayload({
              source,
              video,
              mapping,
              automationDecision,
              snapshot,
              syncedAt: now,
            });

            let sourceRecordId: string | null = null;
            const sourceInsert = await client
              .from("content_sources")
              .insert({
                source_type: "imported",
                channel_id: source.id,
                external_source_id: video.externalSourceId,
                import_status: "imported",
                source_payload: sourcePayload,
                imported_at: now,
                created_at: now,
                updated_at: now,
              })
              .select("id")
              .single();
            if (sourceInsert.error) {
              if (sourceInsert.error.code === "23505") {
                const existingSource = await client
                  .from("content_sources")
                  .select("id")
                  .eq("channel_id", source.id)
                  .eq("external_source_id", video.externalSourceId)
                  .limit(1)
                  .maybeSingle();
                if (existingSource.error) throw existingSource.error;
                sourceRecordId = existingSource.data?.id ?? null;
              } else {
                throw sourceInsert.error;
              }
            } else {
              sourceRecordId = sourceInsert.data.id;
            }

            const itemInsert = await client
              .from("content_items")
              .insert({
                slug,
                title: video.title,
                excerpt: video.excerpt,
                description: video.description,
                body: video.body || null,
                category_id: mapping.categoryId,
                series_id: mapping.seriesId,
                platform_id: source.platformId,
                source_type: "imported",
                content_source_id: sourceRecordId,
                external_source_id: video.externalSourceId,
                import_status: "imported",
                status: automationDecision.targetStatus,
                moderation_status: "clean",
                published_at: publishedAt,
                duration_minutes: 0,
                cover: deriveThumbnailCover(video),
                source_payload: sourcePayload,
                featured: false,
                created_at: now,
                updated_at: now,
              })
              .select("id")
              .single();
            if (itemInsert.error) {
              if (itemInsert.error.code === "23505") {
                const duplicateItem = await client
                  .from("content_items")
                  .select("id")
                  .eq("external_source_id", video.externalSourceId)
                  .limit(1)
                  .maybeSingle();
                if (duplicateItem.error) throw duplicateItem.error;
                run.skippedCount += 1;
                itemResults.push({
                  externalSourceId: video.externalSourceId,
                  status: "skipped_duplicate",
                  contentItemId: duplicateItem.data?.id,
                });
                continue;
              }
              throw itemInsert.error;
            }

            const insertedContentItemId = itemInsert.data.id;
            const linkInsert = await client.from("external_links").insert({
              content_item_id: insertedContentItemId,
              link_kind: "youtube",
              label: "Open source",
              url: primaryUrl,
              is_primary: true,
              created_at: now,
            });
            if (linkInsert.error) throw linkInsert.error;

            if (mapping.tagIds.length > 0) {
              const tagInsert = await client.from("content_item_tags").insert(
                mapping.tagIds.map((tagId) => ({
                  content_item_id: insertedContentItemId,
                  tag_id: tagId,
                  created_at: now,
                })),
              );
              if (tagInsert.error) throw tagInsert.error;
            }

            run.createdCount += 1;
            itemResults.push({
              externalSourceId: video.externalSourceId,
              status: "created",
              contentItemId: insertedContentItemId,
              mappingConfidence: mapping.confidence,
              automationReviewState: automationDecision.reviewState,
              automationPublishDecision: automationDecision.publishDecision,
            });
            continue;
          }

          const snapshot = readImportSnapshot(existing);
          const mergedText = mergeImportedTextContent(existing, video, snapshot);
          const suggestedSlug = ensureUniqueSlug(slugRegistry, video.slug, existing.id);
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
            needsReview: mapping.needsReview || manualOverrideDetected,
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
            existing:
              existing.sourcePayload && typeof existing.sourcePayload === "object"
                ? (existing.sourcePayload as Record<string, unknown>)
                : null,
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

          const itemUpdate = await client
            .from("content_items")
            .update({
              title: nextTitle,
              slug: nextSlug,
              excerpt: mergedText.excerpt,
              description: mergedText.description,
              body: mergedText.body ?? null,
              category_id: nextCategoryId,
              series_id: nextSeriesId,
              platform_id: source.platformId,
              source_type: "imported",
              import_status: "imported",
              status: nextAutomationDecision.targetStatus,
              published_at: nextPublishedAt,
              updated_at: now,
              cover: deriveThumbnailCover(video),
              source_payload: nextSourcePayload,
            })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (itemUpdate.error) throw itemUpdate.error;

          const existingPrimaryLink = await client
            .from("external_links")
            .select("id")
            .eq("content_item_id", existing.id)
            .eq("is_primary", true)
            .limit(1)
            .maybeSingle();
          if (existingPrimaryLink.error) throw existingPrimaryLink.error;

          if (existingPrimaryLink.data?.id) {
            const primaryLinkUpdate = await client
              .from("external_links")
              .update({
                url: nextPrimaryUrl,
                label: "Open source",
                link_kind: "youtube",
              })
              .eq("id", existingPrimaryLink.data.id);
            if (primaryLinkUpdate.error) throw primaryLinkUpdate.error;
          } else {
            const primaryLinkInsert = await client.from("external_links").insert({
              content_item_id: existing.id,
              link_kind: "youtube",
              label: "Open source",
              url: nextPrimaryUrl,
              is_primary: true,
              created_at: now,
            });
            if (primaryLinkInsert.error) throw primaryLinkInsert.error;
          }

          const deleteTags = await client
            .from("content_item_tags")
            .delete()
            .eq("content_item_id", existing.id);
          if (deleteTags.error) throw deleteTags.error;

          if (nextTagIds.length > 0) {
            const insertTags = await client.from("content_item_tags").insert(
              nextTagIds.map((tagId) => ({
                content_item_id: existing.id,
                tag_id: tagId,
                created_at: now,
              })),
            );
            if (insertTags.error) throw insertTags.error;
          }

          if (existing.contentSourceId) {
            const updateSource = await client
              .from("content_sources")
              .update({
                channel_id: source.id,
                external_source_id: video.externalSourceId,
                import_status: "imported",
                source_payload: nextSourcePayload,
                imported_at: now,
                updated_at: now,
              })
              .eq("id", existing.contentSourceId);
            if (updateSource.error) throw updateSource.error;
          } else {
            const insertedSource = await client
              .from("content_sources")
              .insert({
                source_type: "imported",
                channel_id: source.id,
                external_source_id: video.externalSourceId,
                import_status: "imported",
                source_payload: nextSourcePayload,
                imported_at: now,
                created_at: now,
                updated_at: now,
              })
              .select("id")
              .single();
            if (insertedSource.error) throw insertedSource.error;

            const bindSource = await client
              .from("content_items")
              .update({
                content_source_id: insertedSource.data.id,
              })
              .eq("id", existing.id);
            if (bindSource.error) throw bindSource.error;
          }

          run.updatedCount += 1;
          itemResults.push({
            externalSourceId: video.externalSourceId,
            status: "updated",
            contentItemId: existing.id,
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

      const finishedAt = new Date().toISOString();
      run.itemResults = itemResults;
      run.status = summarizeRunStatus(run);
      run.finishedAt = finishedAt;
      run.lockReleasedAt = finishedAt;
      run.errorMessage = null;

      await this.persistImportRun(run);

      const sourceUpdate = await client
        .from("source_channels")
        .update({
          external_channel_id: isCanonicalYouTubeChannelId(source.externalChannelId)
            ? source.externalChannelId
            : resolved.channelId,
          last_synced_at: finishedAt,
          last_successful_sync_at:
            run.status === "success" || run.status === "partial_success"
              ? finishedAt
              : source.lastSuccessfulSyncAt ?? null,
          last_error_at: run.status === "failed" ? finishedAt : null,
          last_error_message: run.status === "failed" ? run.errorMessage ?? "Ingestion failed" : null,
          updated_at: finishedAt,
        })
        .eq("id", source.id);
      if (sourceUpdate.error) throw sourceUpdate.error;

      return run;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Ingestion failed";

      run.status = "failed";
      run.errorMessage = message;
      run.finishedAt = finishedAt;
      run.lockReleasedAt = finishedAt;
      run.failedCount = run.failedCount || 1;
      await this.persistImportRun(run);

      const sourceErrorUpdate = await client
        .from("source_channels")
        .update({
          last_synced_at: finishedAt,
          last_error_at: finishedAt,
          last_error_message: message,
          updated_at: finishedAt,
        })
        .eq("id", source.id);
      if (sourceErrorUpdate.error) throw sourceErrorUpdate.error;

      return run;
    }
  }

  async runAllActiveSourceSync(options?: { requestKey?: string }): Promise<ImportRun[]> {
    const channels = await this.listSourceChannels();
    const active = channels.filter((channel) => channel.isActive);
    const runs: ImportRun[] = [];

    for (const source of active) {
      const run = await this.runSourceSync(source.id, {
        trigger: "sync_all",
        requestKey: options?.requestKey ?? `sync-all:${Date.now()}`,
      });
      runs.push(run);
    }

    return runs;
  }

  async getImportRunById(id: string): Promise<ImportRun | null> {
    const client = ensureClient();
    const runResult = await client
      .from("import_runs")
      .select(
        "id, source_channel_id, status, started_at, finished_at, created_count, updated_count, skipped_count, failed_count, error_message, trigger, parent_run_id, request_key, lock_acquired_at, lock_released_at, source_channels(id, slug, title)",
      )
      .eq("id", id)
      .maybeSingle();
    if (runResult.error) throw runResult.error;
    if (!runResult.data) return null;

    const itemResult = await client
      .from("import_run_items")
      .select("import_run_id, external_source_id, content_item_id, status, message, created_at")
      .eq("import_run_id", id)
      .order("created_at", { ascending: true });
    if (itemResult.error) throw itemResult.error;

    return mapImportRunRow({
      row: runResult.data as unknown as DbImportRunRow,
      itemRows: (itemResult.data ?? []) as DbImportRunItemRow[],
    });
  }

  async listImportRuns(limit?: number): Promise<ImportRun[]> {
    const client = ensureClient();
    const requestedLimit = Number.isFinite(limit ?? Number.NaN)
      ? Math.max(1, Math.min(250, limit ?? 20))
      : 20;
    const runResult = await client
      .from("import_runs")
      .select(
        "id, source_channel_id, status, started_at, finished_at, created_count, updated_count, skipped_count, failed_count, error_message, trigger, parent_run_id, request_key, lock_acquired_at, lock_released_at, source_channels(id, slug, title)",
      )
      .order("started_at", { ascending: false })
      .limit(requestedLimit);
    if (runResult.error) throw runResult.error;

    const rows = (runResult.data ?? []) as unknown as DbImportRunRow[];
    if (rows.length === 0) {
      return [];
    }

    const runIds = rows.map((row) => row.id);
    const itemResult = await client
      .from("import_run_items")
      .select("import_run_id, external_source_id, content_item_id, status, message, created_at")
      .in("import_run_id", runIds)
      .order("created_at", { ascending: true });
    if (itemResult.error) throw itemResult.error;

    const itemRows = (itemResult.data ?? []) as DbImportRunItemRow[];
    const itemRowsByRunId = new Map<string, DbImportRunItemRow[]>();
    for (const row of itemRows) {
      const next = itemRowsByRunId.get(row.import_run_id) ?? [];
      next.push(row);
      itemRowsByRunId.set(row.import_run_id, next);
    }

    return rows.map((row) =>
      mapImportRunRow({
        row,
        itemRows: itemRowsByRunId.get(row.id) ?? [],
      }),
    );
  }
}
