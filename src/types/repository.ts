import type {
  Category,
  CommentRecord,
  CommentStatus,
  ContentStatus,
  CreateCommentInput,
  ImportRun,
  ImportRunTrigger,
  CreateSourceChannelInput,
  CreateManualContentInput,
  Platform,
  ReactionRecord,
  ResolvedContentItem,
  ResolvedSourceChannel,
  Series,
  Tag,
  UpdateCommentModerationInput,
  UpdateContentItemInput,
  UpsertReactionInput,
  UpsertReactionResult,
} from "@/types/content";

export interface ContentRepository {
  listArchiveItems(): Promise<ResolvedContentItem[]>;
  listAdminContentItems(): Promise<ResolvedContentItem[]>;
  getItemBySlug(slug: string): Promise<ResolvedContentItem | null>;
  getAdminItemById(id: string): Promise<ResolvedContentItem | null>;
  createManualContentItem(
    input: CreateManualContentInput,
  ): Promise<{ slug: string; id: string }>;
  updateContentItem(input: UpdateContentItemInput): Promise<{ slug: string; id: string }>;
  setContentItemStatus(
    id: string,
    status: ContentStatus,
  ): Promise<{ id: string; status: ContentStatus }>;
  listSourceChannels(): Promise<ResolvedSourceChannel[]>;
  createSourceChannel(input: CreateSourceChannelInput): Promise<{ id: string; slug: string }>;
  runSourceSync(
    sourceId: string,
    options?: {
      trigger?: ImportRunTrigger;
      parentRunId?: string;
      requestKey?: string;
      lockAcquiredAt?: string;
      lockReleasedAt?: string;
    },
  ): Promise<ImportRun>;
  runAllActiveSourceSync(options?: { requestKey?: string }): Promise<ImportRun[]>;
  getImportRunById(id: string): Promise<ImportRun | null>;
  listImportRuns(limit?: number): Promise<ImportRun[]>;
  listCommentsForContentItem(
    contentItemId: string,
    options?: { statuses?: CommentStatus[] },
  ): Promise<CommentRecord[]>;
  createComment(input: CreateCommentInput): Promise<CommentRecord>;
  setCommentModeration(input: UpdateCommentModerationInput): Promise<CommentRecord>;
  listModerationComments(filters?: {
    status?: CommentStatus | "all";
    q?: string;
    limit?: number;
  }): Promise<CommentRecord[]>;
  listReactionsForContentItem(contentItemId: string): Promise<ReactionRecord[]>;
  upsertReaction(input: UpsertReactionInput): Promise<UpsertReactionResult>;
  listTaxonomy(): Promise<{
    categories: Category[];
    series: Series[];
    platforms: Platform[];
    tags: Tag[];
  }>;
}

export interface ArchiveDataBundle {
  categories: Category[];
  series: Series[];
  platforms: Platform[];
  tags: Tag[];
  items: ResolvedContentItem[];
}
