export type ExternalLinkKind =
  | "video"
  | "youtube"
  | "twitch"
  | "vk_video"
  | "telegram"
  | "docs"
  | "other";

export type SourceType = "manual" | "imported";
export type ImportStatus =
  | "not_applicable"
  | "pending"
  | "imported"
  | "failed"
  | "skipped";
export type ContentStatus = "draft" | "published" | "archived";
export type ModerationStatus =
  | "clean"
  | "pending_review"
  | "flagged"
  | "blocked";
export type CommentStatus = "pending" | "approved" | "rejected" | "hidden";
export type ReactionType = "like" | "love" | "insight" | "fire";
export type CommentFeedbackType = "up" | "down";
export type CommunityIdentityMode = "guest_cookie_v1";
export type ImportRunStatus =
  | "queued"
  | "running"
  | "success"
  | "partial_success"
  | "failed";
export type ImportRunTrigger =
  | "sync_source"
  | "sync_all"
  | "rerun_source"
  | "retry_failed_items";
export type ImportItemResultStatus =
  | "created"
  | "updated"
  | "skipped_duplicate"
  | "failed";

export interface Category {
  id: string;
  slug: string;
  title: string;
  description: string;
}

export interface Series {
  id: string;
  slug: string;
  categoryId: string;
  title: string;
  description: string;
}

export interface Tag {
  id: string;
  slug: string;
  label: string;
}

export interface Platform {
  id: string;
  slug: string;
  title: string;
  kind: "video" | "stream" | "social";
  baseUrl: string;
}

export interface SourceChannel {
  id: string;
  slug: string;
  title: string;
  platformId: string;
  isActive: boolean;
  notes?: string | null;
  externalChannelId?: string | null;
  sourceUrl?: string | null;
  lastSyncedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  isSyncInProgress?: boolean;
  lastPlaylistSyncedAt?: string | null;
  lastPlaylistCount?: number | null;
  lastPlaylistItemCount?: number | null;
  playlistSyncMode?: "api_primary" | "disabled_no_api_key" | "error" | null;
  playlistSyncMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Playlist {
  id: string;
  sourceChannelId: string;
  externalPlaylistId: string;
  slug: string;
  title: string;
  description?: string | null;
  externalUrl: string;
  thumbnailUrl?: string | null;
  itemCount: number;
  syncedItemCount: number;
  linkedItemCount: number;
  isActive: boolean;
  publishedAt?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string | null;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  contentItemId?: string | null;
  externalVideoId: string;
  position: number;
  title?: string | null;
  addedAt?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentSource {
  id: string;
  sourceType: SourceType;
  channelId?: string | null;
  externalSourceId?: string | null;
  importStatus: ImportStatus;
  sourcePayload?: Record<string, unknown> | null;
  importedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalLink {
  kind: ExternalLinkKind;
  label: string;
  url: string;
}

export interface CoverAsset {
  kind: "gradient" | "image";
  alt: string;
  palette: [string, string];
  src?: string;
}

export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  categoryId?: string;
  seriesId?: string | null;
  platformId: string;
  sourceType?: SourceType;
  contentSourceId?: string | null;
  externalSourceId?: string | null;
  importStatus?: ImportStatus;
  status?: ContentStatus;
  moderationStatus?: ModerationStatus;
  tagIds: string[];
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  durationMinutes: number;
  excerpt: string;
  description: string;
  body?: string;
  cover: CoverAsset;
  links: ExternalLink[];
  sourcePayload?: Record<string, unknown> | null;
  featured?: boolean;
}

export interface ResolvedContentItem extends ContentItem {
  category: Category;
  series: Series | null;
  platform: Platform;
  tags: Tag[];
  primaryLink?: ExternalLink;
  source: ContentSource | null;
}

export interface CommentRecord {
  id: string;
  contentItemId: string;
  parentId?: string | null;
  identityMode?: CommunityIdentityMode;
  authorUserId?: string | null;
  authorDisplay: string;
  authorFingerprint?: string | null;
  body: string;
  status: CommentStatus;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  authorReputationCoefficient?: number | null;
  trustDecision?: CommentTrustDecision | null;
  feedbackSummary?: CommentFeedbackSummary;
  authorReputation?: CommentAuthorReputation;
  createdAt: string;
  updatedAt: string;
}

export interface ReactionRecord {
  id: string;
  contentItemId: string;
  reactionType: ReactionType;
  actorUserId?: string | null;
  actorFingerprint?: string | null;
  createdAt: string;
}

export type CommentTrustDecision = "auto_publish" | "moderation_required" | "neutral_pending";

export interface CommentFeedbackRecord {
  id: string;
  commentId: string;
  contentItemId: string;
  feedbackType: CommentFeedbackType;
  actorUserId?: string | null;
  actorFingerprint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentFeedbackSummary {
  total: number;
  up: number;
  down: number;
  score: number;
  activeFeedbackType: CommentFeedbackType | null;
}

export interface CommentAuthorReputation {
  coefficient: number;
  totalPositive: number;
  totalNegative: number;
  totalVotes: number;
  totalComments: number;
  ratedComments: number;
  signal: "low" | "medium" | "high";
}

export interface ReactionSummaryItem {
  reactionType: ReactionType;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface CommunityReactionSummary {
  total: number;
  items: ReactionSummaryItem[];
  activeReactionType: ReactionType | null;
}

export interface CreateCommentInput {
  contentItemId: string;
  authorUserId?: string | null;
  authorDisplay: string;
  authorFingerprint: string;
  body: string;
  identityMode: CommunityIdentityMode;
  initialStatus?: CommentStatus;
  initialModerationStatus?: ModerationStatus;
  initialModerationReason?: string | null;
  authorReputationCoefficient?: number | null;
  trustDecision?: CommentTrustDecision | null;
}

export interface UpdateCommentModerationInput {
  commentId: string;
  status: CommentStatus;
  moderationReason?: string;
}

export interface UpsertReactionInput {
  contentItemId: string;
  reactionType: ReactionType;
  actorUserId?: string | null;
  actorFingerprint: string;
}

export interface UpsertReactionResult {
  action: "created" | "updated" | "removed" | "unchanged";
  reaction: ReactionRecord | null;
}

export interface UpsertCommentFeedbackInput {
  commentId: string;
  contentItemId: string;
  feedbackType: CommentFeedbackType;
  actorUserId?: string | null;
  actorFingerprint: string;
}

export interface UpsertCommentFeedbackResult {
  action: "created" | "updated" | "removed" | "unchanged";
  feedback: CommentFeedbackRecord | null;
}

export interface ImportRunItemResult {
  externalSourceId: string;
  status: ImportItemResultStatus;
  contentItemId?: string;
  message?: string;
  mappingConfidence?: "high" | "medium" | "low";
  automationReviewState?: "review_needed" | "review_light" | "auto_published";
  automationPublishDecision?: "keep_draft" | "review_required" | "auto_publish";
}

export interface ImportRun {
  id: string;
  sourceChannelId: string;
  sourceChannelSlug: string;
  sourceChannelTitle: string;
  trigger?: ImportRunTrigger;
  parentRunId?: string | null;
  requestKey?: string | null;
  status: ImportRunStatus;
  startedAt: string;
  finishedAt?: string | null;
  lockAcquiredAt?: string | null;
  lockReleasedAt?: string | null;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorMessage?: string | null;
  itemResults: ImportRunItemResult[];
}

export interface IngestionSourceLock {
  id: string;
  sourceChannelId: string;
  sourceChannelSlug: string;
  sourceChannelTitle: string;
  trigger: ImportRunTrigger;
  requestKey?: string;
  runId?: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface IngestionLockSnapshot {
  globalSyncAllLock: IngestionSourceLock | null;
  sourceLocks: IngestionSourceLock[];
}

export interface SyncAllExecutionResult {
  runs: ImportRun[];
  skippedLockedSources: Array<{
    sourceChannelId: string;
    sourceChannelSlug: string;
    sourceChannelTitle: string;
    reason: string;
  }>;
}

export type SortMode = "newest" | "oldest";

export interface ArchiveFilters {
  search: string;
  category: string;
  series: string;
  platform: string;
  sort: SortMode;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface CreateManualContentInput {
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  body?: string;
  categorySlug: string;
  seriesSlug?: string;
  platformSlug: string;
  externalUrl: string;
  publishedAt?: string;
  status: ContentStatus;
  sourceType: "manual";
  bootstrapKey?: string;
}

export interface UpdateContentItemInput {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  body?: string;
  categorySlug: string;
  seriesSlug?: string;
  platformSlug: string;
  externalUrl: string;
  publishedAt?: string;
  status: ContentStatus;
}

export interface CreateSourceChannelInput {
  title: string;
  slug: string;
  platformSlug: string;
  externalChannelId?: string;
  sourceUrl?: string;
  notes?: string;
  isActive: boolean;
}

export interface ResolvedSourceChannel extends SourceChannel {
  platform: Platform;
}
